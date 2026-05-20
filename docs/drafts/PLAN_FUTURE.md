# Performance Optimization Plan - 2026-05-05

## Advanced Features

- [ ] **Custom Operators (<=>)** (2-3 hours) - _Important_
    - [ ] Parse custom operators (PostgreSQL allows custom operators)
    - [ ] Type checking for custom operators
    - [ ] Support for vector distance operators

## Type-Level Parser Performance Improvements

### Goals

- Reduce IDE Language Server response time
- Avoid "Type instantiation is excessively deep" errors
- Improve compile-time performance for complex queries

---

## Optimization Tasks

- [ ] **Tail-Call Optimization (TCO)**
    - [ ] Audit recursive parsers
    - [ ] Use accumulator pattern
    - [ ] Ensure recursive call is top-level return

- [ ] **Flat Expression Parser**
    - [ ] Implement Pratt Parser or Shunting Yard Algorithm
    - [ ] Replace recursive descent with single loop
    - [ ] Reduce nesting depth

- [ ] **O(1) AST Resolution**
    - [ ] Convert ResolveExpressionAST to indexed access type
    - [ ] Replace O(N) sequential conditionals with O(1) dispatch
    - [ ] Use type-level registry map

---

## Expected Impact

- **10-50x faster** IDE responsiveness
- **Fewer "excessively deep"** compiler errors
- **Better scalability** for complex queries
