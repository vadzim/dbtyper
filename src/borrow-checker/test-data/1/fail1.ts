export type X</*@consume*/ T> = [1, T]
export type A<T> = T extends infer P ? (1 extends T ? [1, X<P>] : [2, T]) : never
export type B<TT> = A<TT> extends [infer T1, infer T2] ? [T1, T2] : [0, TT]
export type C<TT> = TT extends [infer T1, infer T2] ? [A<T1>, TT] : []
export type D<TT> = TT extends [infer T1, infer T2] ? [A<T1>, T2] : []
export type E<TT> = TT extends [infer T1, infer T2] ? [A<TT>, T2] : []
