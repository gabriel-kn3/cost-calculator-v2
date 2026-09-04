/**
 * Types for the hand-rolled CSV parser. Every value is a string: the parser
 * does no coercion, deliberately, so the frozen-math baseline sees exactly the
 * text that was exported.
 */
export declare function parseCsv(text: string): Array<Record<string, string>>;
