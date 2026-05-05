#!/usr/bin/env python3
"""
Split integration test file with multiple .query() calls into separate files.
Each new file will have exactly one .query() call.
"""

import os
import re
import sys

def parse_queries(lines):
    """Parse all queries from test file."""
    queries = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Шукаем каментар з апісаннем
        match = re.match(r'\s*// (✅|❌) (SUCCESS|ERROR): (.+)', line)
        if match:
            marker = match.group(1)
            status = match.group(2)
            description = match.group(3).strip()
            
            # Наступны радок павінен быць const resultN = await db.query(
            i += 1
            if i < len(lines) and 'await db.query(' in lines[i]:
                query_lines = []
                paren_count = 0
                started = False
                
                while i < len(lines):
                    current = lines[i]
                    query_lines.append(current)
                    
                    # Лічым дужкі
                    for char in current:
                        if char == '(':
                            paren_count += 1
                            started = True
                        elif char == ')':
                            paren_count -= 1
                            if started and paren_count == 0:
                                break
                    
                    if started and paren_count == 0:
                        break
                        
                    i += 1
                
                # Выдаляем "const resultN = await db.query(" і закрываючую дужку
                query_text = ''.join(query_lines)
                query_text = re.sub(r'^\s*const result\d+ = await db\.query\(', '', query_text)
                query_text = re.sub(r'\)\s*$', '', query_text)
                
                queries.append({
                    'marker': marker,
                    'status': status,
                    'description': description,
                    'query': query_text.strip()
                })
        
        i += 1
    
    return queries

def extract_setup(content):
    """Extract setup code (imports, mockDriver, table creation)."""
    lines = content.split('\n')
    
    # Знаходзім радок з "async function"
    setup_lines = []
    in_function = False
    
    for line in lines:
        if 'async function' in line:
            in_function = True
            setup_lines.append(line)
            continue
        
        if in_function:
            if '.database()' in line:
                setup_lines.append(line)
                break
            setup_lines.append(line)
        else:
            setup_lines.append(line)
    
    return '\n'.join(setup_lines)

def generate_file_name(description, prefix):
    """Generate file name from description."""
    file_name_base = description.lower()
    file_name_base = re.sub(r'[^\w\s-]', '', file_name_base)
    file_name_base = re.sub(r'\s+', '-', file_name_base)
    file_name_base = re.sub(r'-+', '-', file_name_base)
    return f"{prefix}-{file_name_base}"

def split_file(source_path, prefix):
    """Split test file into multiple files."""
    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
    
    # Парсім запыты
    queries = parse_queries(lines)
    
    if len(queries) <= 1:
        print(f"File has {len(queries)} queries, no need to split")
        return []
    
    # Выдаляем setup
    setup = extract_setup(content)
    
    # Шаблон
    template = """{setup}

\t// {marker} {status}: {description}
\tconst result = await db.query({query})

\treturn result
}}

test()
"""
    
    # Ствараем файлы
    output_dir = os.path.dirname(source_path)
    created = []
    
    for q in queries:
        file_name = generate_file_name(q['description'], prefix)
        
        if q['status'] == "SUCCESS":
            file_name += ".success.test.ts"
        else:
            file_name += ".error.test.ts"
        
        content = template.format(
            setup=setup,
            marker=q['marker'],
            status=q['status'],
            description=q['description'],
            query=q['query']
        )
        
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        created.append(file_name)
    
    return created

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: split-test-file.py <source_file> <prefix>")
        print("Example: split-test-file.py select-with-enums.success.test.ts select-enum")
        sys.exit(1)
    
    source_file = sys.argv[1]
    prefix = sys.argv[2]
    
    if not os.path.exists(source_file):
        print(f"Error: File not found: {source_file}")
        sys.exit(1)
    
    created = split_file(source_file, prefix)
    
    print(f"Created {len(created)} files:")
    for fn in created:
        print(f"  ✓ {fn}")
