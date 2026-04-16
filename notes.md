# Notes

TS project.

In a type declaration body, ternary operators create a ternary tree.
If there's no ternary operator in a type declaration body then the type declaration body ternary tree consists of exactly one tree node.
If there's exactly one ternary operator in a type declaration body then the ternary tree consists of exactly three tree nodes, one root and two leaves.
The more ternary operatos is in a type declaration body the more leaves the ternary tree contains.

If some type is marked as opaque then a type variable that extends (through type parameter or infer) that opaque type can be referenced (consumed) only once in a path from some leaf toward the root of that ternary tree. Such a type is called a "consumer" of that opaque type. If some type variable does not appear in the type declaration body then such type is called a "reader" of that opaque type.

"Readers" actually is not counted when looking for opaque type consumings. That means if some type variable V extends type T marked as opaque, and R is a reader, then R<V> actually is not consumes type T, such call can be used arbitraty times in type declaration. Only usages of V not wrapped by calls to readers are taken into account. So if all the occurances of opaque type variables are wrapped in calls of "readers" in a type declaration body, then that type is also marked as "reader" of that opaque type and so on.

The engine can be told to force treat some generic type in some file as a reader.

If type variable A extending an opaque type is wrapped into smth before it is passed to a "reader", then that counts as a consuming of the variable. E.g. if R is "reader" and C is not "reader" ("consumer"), then `R<A>` does not consume A, `R<[A]>` consumes A, `R<C<A>>` consumes A, `C<A>` consumes A.

Type variables extending opaque type can be passed to some generic type only if at that argument position generic type has a parameter name that extends that same opaque type.
E.g. if O is opaque type then `type G<A extends O> = ...; type X<A extends O>= ... G<A> ...` is allowed, but `type G<A> = ...; type X<A extends O>= ... G<A> ...` or `type G<A extends [U]> = ...; type X<A extends O>= ... G<A> ...` is disallowed.

The type variable extending opaque type cannot be destructured in any way. It cannot appear at all in the conditional part of a ternary operator, except new variables of the opaque type are inferred.

Opaque type itself can be used for inferring only as itself, but as a part of a more complex type.
E.g. if O is opaque type then ` ... extends infer A extends O` is allowed and ` ... extends infer A extends [O]` or ` ... extends infer A extends X<O>` is disallowed.

Please design and implement:

- a function `parseTypes` which gets path name (string), content (string), prefix fo ids (string) and returns a list of types and a list of scopes. It uses typescript to parse content. This is just a memory operation. It does not perform any external operations with file system or network. It uses path only for resolving imports to save that resolve path to the type props. It does not use cwd to make path absolute. Every type has its name, a copy of path value, if this type is imported it has a refPath - resolve path + import path, otherwise refPath is equal to Path, id of scope in which the type was declared, position of start letter of name of type when it was declared in the content (at least col, row, start), etc. Scopes are generated for all cases they are needed, where type variables can be intoduced via type parameters or infers or declarations. It does not return any ast or source code.

- tests for all edge case for `parseTypes`

- a function `checkOpaque` which gets type array and scope array and returns array of violations of opaque type rules above. Each item describes one violation: what it is, position, optional the second position e.g. for the previous consuming of the type variable. It does not return any ast or source code.

- for tests node:test should be used.

- tests for source -> checkOpaque should be organized in such way:
  a file with array of source code samples (strings in backticks), the first line of the sample is a comment which is a name of the test, the first word of that comment is either 'ok:' or 'fail:'. Then in a loop all the items of an array are processed. This makes tests more readable.

Other tests should be organized in best practices.
