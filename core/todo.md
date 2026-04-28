- design and extract expression parser:
  -- it should check correctness of references
  -- it should validate types of references if applicable like real postgres does for operations like math or strings or bools
  -- it should return type of expression
  -- it should get scope in which to resolve names and how catalog is limited - e.g. in select you cannot access object which you didn't enumerate in from clause

- use that expression parser
  -- where clause should check the correctness of returned type of expression
  -- select should use that info to return types of columns
