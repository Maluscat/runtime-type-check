export type Article = 'a' | 'an';
/** Extended `typeof`. Used in {@link RuntimeTypeCheck.getType}. */
export type Type = 'array' | 'NaN' | 'null' | 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';
/**
 * Data describing attributes of a value that did not pass
 * a condition's assertion. Utilized in {@link Condition.is}.
 */
export interface IsData {
    val: any;
    type: Type;
    article: Article;
}
export interface ExpectedData {
    type: string;
}
/**
 * Contains the three parts of the message used to denote the
 * expected type of the form "[before] [type] [after]".
 *
 * Message parts from extended conditions (via {@link Condition.conditions})
 * will be inherited and merged.
 *
 * @example
 * Extending {@link RuntimeTypeCheck.Cond.number} will inherit its
 * `type` as `"number"`. Building a `before: "positive"` on top of
 * it will create the following Message:
 * ```ts
 * {
 *   before: 'positive',
 *   type: 'number',
 * }
 * ```
 * And yield the following sentence: `"Expected positive number [...]"`.
 */
export interface Message {
    before?: string;
    type?: string;
    after?: string;
}
interface MessagePartial {
    before: string[];
    type?: string;
    after: string[];
}
export interface Condition {
    /**
     * Further conditions that this condition relies on. The passed value
     * in {@link assert} is ensured to match these conditions.
     *
     * Note that this is a {@link Descriptor}, so it is an OR list of AND lists.
     *
     * For example, a condition asserting a positive number
     * may specify the condition of type number.
     */
    conditions?: Descriptor;
    /**
     * Assertion function for an arbitrary value.
     *
     * The passed value is ensured to match the specified
     * {@link Descriptor} in {@link Condition.conditions}, if any.
     */
    assert: (value: any) => boolean;
    /**
     * Denote what the expected value should be.
     * @see {@link Message}.
     *
     * @example
     * Assuming the condition asserts a positive number and specifies the
     * further condition {@link RuntimeTypeCheck.Cond.number}.
     * The attribute "positive" can then simply be added to the front of the type.
     * The type itself ("number") is contributed by the extended condition,
     * so we don't have to care about that:
     *
     * ```js
     * shouldBe: { before: 'positive' }
     * ```
     *
     * The final error message will then be:
     * "Expected positive number, got [...]."
     */
    shouldBe: Message;
    /**
     * Sentence denoting what the value is when it does not assert.
     * In simple cases, this is usually a description of the opposite
     * of the assertion. The sentence should always start with a lowercase
     * indefinite article (a or an).
     *
     * For advanced use cases, a function may be specified which takes
     * an {@link IsData} object that contains useful information about
     * the value in question.
     *
     * @example Simple
     * Assuming the condition asserts a positive number, the `is`
     * value could be "a negative number or 0", which is a
     * description of the exact opposite of the expected value.
     *
     * The final error message will then be:
     * "Expected [...], got a negative number or 0."
     *
     * @example Advanced
     * Assuming the condition asserts the length of a value and
     * the specified further conditions are therefore
     * {@link RuntimeTypeCheck.Cond.array} and {@link RuntimeTypeCheck.Cond.string}.
     *
     * The type or value of the value are unknown, so we can utilize the
     * method to get type and article and append a sentence describing
     * the value:
     * ```js
     * ({ type, article }) => `${article} ${type} of a different length`.
     * ```
     *
     * In case of an array, the final error message will then be:
     * "Expected [...], got an array of a different length"
     */
    is: string | ((data: IsData) => string);
}
/**
 * List of possible conditions, *any* of which may match.
 * Thus, it is a disjunction of conjunctions (OR list of AND lists).
 */
export type Descriptor = ConditionList[];
/**
 * Either a single condition that must match, or
 * a list of conditions, *all* of which must match.
 */
export type ConditionList = Condition | Condition[];
export declare class Cond {
    #private;
    /** Assert a value to be of {@link Type}. */
    static typeof: typeof Cond.__#1@#conditionTypeof;
    /** Assert a value to be a boolean. */
    static boolean: Condition;
    /** Assert a value to be a function. */
    static function: Condition;
    /** Assert a value to be a number. */
    static number: Condition;
    /** Assert a value to be a string. */
    static string: Condition;
    /** Assert a value to be `true`. Implies {@link boolean}. */
    static true: Condition;
    /** Assert a value to be `false`. Implies {@link boolean}. */
    static false: Condition;
    /**
     * Assert a value to be an integer (only whole numbers).
     * Implies {@link number}.
     */
    static integer: Condition;
    /**
     * Generate a condition that asserts a value to be an array,
     * optionally with the given descriptor inside it.
     *
     * This function itself is a condition without inner types,
     * so using it as `Cond.array` is an alias to `Cond.array()`
     */
    static array(...descriptor: Descriptor): Condition;
    /**
     * Generate a condition that asserts a value to be an object literal,
     * optionally with the given descriptor inside it.
     *
     * This function itself is a condition without inner types,
     * so using it as `Cond.object` is an alias to `Cond.object()`
     *
     * @param keyName A concise key description used when displaying the type: `Object<keyName, ...>`.
     */
    static object(keyName?: string, ...descriptor: Descriptor): Condition;
    /**
     * Assert a value to be not negative (0 or more).
     * Implies {@link number}.
     */
    static nonnegative: Condition;
    /**
     * Assert a value to be positive.
     * Implies {@link number}.
     */
    static positive: Condition;
    /**
     * Assert a value to be a non-empty string or a non-empty array.
     * Implies {@link string} OR {@link array}.
     */
    static nonempty: Condition;
    /**
     * Generate a condition that asserts a value to be only the specified strings.
     * Implies {@link string}.
     */
    static keywords(...keywords: string[]): Condition;
    /**
     * Generate a condition that asserts a value to be of the given length.
     * Implies {@link string} OR {@link array}.
     */
    static length(len: number): Condition;
    /**
     * Generate a condition that asserts a value to be inside the given interval (inclusive).
     * Implies {@link number}.
     *
     * @param min Lower interval boundary (inclusive)
     * @param max Upper interval boundary (inclusive)
     */
    static range(min: number, max: number): Condition;
}
export declare class TypeCheckError extends Error {
    expected: string;
    is: string;
    constructor(expected: string, is: string);
}
export declare class RuntimeTypeCheck {
    #private;
    static Cond: typeof Cond;
    /**
     * Assert an arbitrary value to match *any* of the given conditions
     * and throw a detailed explanatory error message if the assertion fails.
     *
     * The conditions are tested recursively through their
     * potential {@link Condition.conditions} field.
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     */
    static assertAndThrow(val: any, ...descriptor: Descriptor): boolean;
    /**
     * Assert an arbitrary value to match *any* of of the given conditions.
     *
     * The conditions are tested recursively through their
     * potential {@link Condition.conditions} field.
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     */
    static assert(val: any, ...descriptor: Descriptor): boolean;
    /**
     * If a given arbitrary value does not assert *any* of the given
     * conditions, return the most relevant failing condition in the
     * context of the given value.
     *
     * The conditions are tested recursively through their
     * potential {@link Condition.conditions} field.
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     *
     * @remarks
     * This method probably doesn't have to concern you. It is used
     * within {@link getMessageIs} to get the most relevant condition
     * for the resulting message.
     *
     * @example
     * ```js
     * assertFind(3.2, Cond.string, [ Cond.positive, Cond.integer ], Cond.true);
     * ```
     * Returns `Cond.integer` because it is the most relevant
     * failing condition for the value `3.2`.
     */
    static assertFind(val: any, ...descriptor: Descriptor): Condition | undefined;
    /**
     * Recursively count passing conditions, weighted by shallowness,
     * and return the failing condition in the context of the maximum pass count.
     *
     * In other words, find the failing condition whose sibling and children
     * conditions pass the most amount of assertions for the given
     * value and are thus the most relevant condition context.
     *
     * This does *not* check if a descriptor as a whole asserts to true.
     *
     * @see {@link assertFind}
     *
     * @internal
     */
    static getMostRelevantFailingCondition(val: any, ...descriptor: Descriptor): Condition | undefined;
    /**
     * Return the result of {@link getMessageIs} for the first
     * of the passed values that does not assert.
     *
     * @param val An **array** of the values to test.
     * @param descriptor The conditions to test the value against.
     */
    static getMessageIsIterated(val: any[], ...descriptor: Descriptor): string | undefined;
    /**
     * Return a string denoting the type of the value in the
     * context of the condition that is closest to matching,
     * or an empty string if all conditions assert correctly.
     *
     * The returned string is simply the result of executing the
     * {@link Condition.is} field of the failing condition.
     *
     * @example
     * Value:        `0`
     * Conditions:   `[ Cond.number, Cond.positive ]`
     * Return value: `"a negative number or 0"`
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     *                   The first failed condition will produce the return value.
     */
    static getMessageIs(val: any, ...descriptor: Descriptor): string;
    /**
     * Return a string denoting the expected type within the passed conditions.
     * The message is created by recursively merging all `shouldBe` fields.
     *
     * @example
     * descriptor 1: `[ Cond.number, Cond.positive ]`
     * descriptor 2: `Cond.keywords("foobar")`
     * Return value: `'positive number OR the keyword "foobar"'`
     */
    static getMessageExpected(...descriptor: Descriptor): string;
    /**
     * Compile a single {@link MessagePartial} into a coherent sentence
     * of the form "[...before] [type] [...after]". A few linguistic
     * transformations are made.
     *
     * @example
     * Input:
     * ```js
     * {
     *   before: [ 'nonverbal', 'positive' ],
     *   type: [ 'integer' ],
     *   after: [ 'that is cool', 'with 6 digits', 'that is divisible by 5' ]
     * }
     * ```
     * Output:
     * `"nonverbal, positive integer with 6 digits that is cool and is divisible by 5"`
     *
     * @internal
     */
    static compilePartialMessage(messagePartial: MessagePartial): string;
    /**
     * Recursively look at the messages defined in the `shouldBe` field
     * of the given descriptors and merge them from bottom to top,
     * returning a disjunction of {@link MessagePartial}s.
     *
     * Disjunction means that every output list item is a standalone
     * message for a seperate assertion (OR).
     *
     * @internal
     */
    static mergeDescriptorMessages(...descriptor: Descriptor): MessagePartial[];
    /**
     * Get the matching indefinite article (a or an) for the passed string.
     *
     * @remarks
     * This method is by no means linguistically sound, it simply checks
     * whether the first character of the passed string is a vowel.
     */
    static getArticle(value: string): "a" | "an";
    /**
     * Get a string list of all items of the passed string array
     * of the style "first, second, third or fourth".
     *
     * @remarks
     * This is used within the {@link RuntimeTypeCheck.Cond.keywords} condition.
     */
    static getPrettyEnumeratedList(list: string[]): string;
    /**
     * Return the `typeof` of a value with the
     * additional types 'array', 'NaN' and 'null'.
     */
    static getType(value: any): Type;
}
export {};
