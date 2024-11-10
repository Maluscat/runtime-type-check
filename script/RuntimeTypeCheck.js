'use strict';
export class Cond {
    static #conditionTypeof(type) {
        return {
            assert: val => RuntimeTypeCheck.getType(val) === type,
            shouldBe: { type: type },
            is: ({ type }) => type
        };
    }
    // ---- Types ----
    /** Assert a value to be of {@link Type}. */
    static typeof = this.#conditionTypeof;
    /** Assert a value to be a boolean. */
    static boolean = this.#conditionTypeof('boolean');
    /** Assert a value to be a function. */
    static function = this.#conditionTypeof('function');
    /** Assert a value to be a number. */
    static number = this.#conditionTypeof('number');
    /** Assert a value to be a string. */
    static string = this.#conditionTypeof('string');
    /** Assert a value to be `true`. Implies {@link boolean}. */
    static true = {
        conditions: [this.boolean],
        assert: val => val === true,
        shouldBe: { type: 'true' },
        is: 'false',
    };
    /** Assert a value to be `false`. Implies {@link boolean}. */
    static false = {
        conditions: [this.boolean],
        assert: val => val === false,
        shouldBe: { type: 'false' },
        is: 'true',
    };
    /**
     * Assert a value to be an integer (only whole numbers).
     * Implies {@link number}.
     */
    static integer = {
        conditions: [this.number],
        assert: val => val % 1 === 0,
        shouldBe: { type: 'integer' },
        is: 'a floating point number'
    };
    /**
     * Generate a condition that asserts a value to be an array,
     * optionally with the given descriptor inside it.
     *
     * This function itself is a condition without inner types,
     * so using it as `Cond.array` is an alias to `Cond.array()`
     */
    static array(...descriptor) {
        return {
            conditions: [this.#conditionTypeof('array')],
            assert: descriptor.length > 0
                ? (val) => val.every(inner => RuntimeTypeCheck.assert(inner, ...descriptor))
                : (val) => true,
            shouldBe: descriptor.length > 0
                ? { type: `Array<${RuntimeTypeCheck.getMessageExpected(...descriptor)}>` }
                : { type: 'array' },
            is: ({ val, type }) => {
                if (type === 'array' && descriptor.length > 0) {
                    if (val.length === 0) {
                        return 'an empty array';
                    }
                    else {
                        return `Array<${RuntimeTypeCheck.getMessageIsIterated(val, ...descriptor)}>`;
                    }
                }
                else
                    return type;
            }
        };
    }
    /**
     * Generate a condition that asserts a value to be an object literal,
     * optionally with the given descriptor inside it.
     *
     * This function itself is a condition without inner types,
     * so using it as `Cond.object` is an alias to `Cond.object()`
     *
     * @param keyName A concise key description used when displaying the type: `Object<keyName, ...>`.
     */
    static object(keyName, ...descriptor) {
        if (keyName && typeof keyName !== 'string')
            throw new Error(`\
Condition 'object': When passing a descriptor, the first parameter \
needs to be a key name, which is used for displaying the type: "Object<keyName, ...>".
(If generic, just use "string")`);
        return {
            conditions: [this.#conditionTypeof('object')],
            assert: descriptor.length > 0
                ? (val) => Object.values(val).every(inner => RuntimeTypeCheck.assert(inner, ...descriptor))
                : (val) => true,
            shouldBe: descriptor.length > 0
                ? { type: `Object<${keyName}, ${RuntimeTypeCheck.getMessageExpected(...descriptor)}>` }
                : { type: 'object' },
            is: ({ val, type }) => {
                if (type === 'object' && descriptor.length > 0) {
                    if (val.length === 0) {
                        return 'an empty object';
                    }
                    else {
                        return `Object<${keyName}, ${RuntimeTypeCheck.getMessageIsIterated(Object.values(val), ...descriptor)}>`;
                    }
                }
                else
                    return type;
            }
        };
    }
    // ---- Misc conditions ----
    /**
     * Assert a value to be positive.
     * Implies {@link number}.
     */
    static positive = {
        conditions: [this.number],
        assert: val => val > 0,
        shouldBe: { before: 'positive' },
        is: 'a negative number or 0'
    };
    /**
     * Assert a value to be a non-empty string or a non-empty array.
     * Implies {@link string} OR {@link array}.
     */
    static nonempty = {
        conditions: [this.array(), this.string],
        assert: val => val.length > 0,
        shouldBe: { before: 'non-empty' },
        is: ({ type, article }) => `${article} empty ${type}`
    };
    // ---- Condition generators ----
    /**
     * Generate a condition that asserts a value to be only the specified strings.
     * Implies {@link string}.
     */
    static keywords(...keywords) {
        return {
            conditions: [this.string],
            assert: val => keywords.includes(val),
            shouldBe: {
                type: keywords.length > 1
                    ? `one of the keywords ${RuntimeTypeCheck.getPrettyEnumeratedList(keywords)}`
                    : `the keyword "${keywords[0]}"`
            },
            is: 'a different string'
        };
    }
    /**
     * Generate a condition that asserts a value to be of the given length.
     * Implies {@link string} OR {@link array}.
     */
    static length(len) {
        return {
            conditions: [this.array(), this.string],
            assert: val => val.length === len,
            shouldBe: { after: `of length ${len}` },
            is: ({ type, article }) => `${article} ${type} of a different length`
        };
    }
}
// Making the generator functions themselves base conditions
Object.assign(Cond.array, Cond.array());
Object.assign(Cond.object, Cond.object());
export class TypeCheckError extends Error {
    expected;
    is;
    constructor(expected, is) {
        super(`Expected ${expected}, got ${is}`);
        this.expected = expected;
        this.is = is;
        this.name = this.constructor.name;
    }
}
export class RuntimeTypeCheck {
    static Cond = Cond;
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
    static assertAndThrow(val, ...descriptor) {
        if (!this.assert(val, ...descriptor)) {
            throw new TypeCheckError(this.getMessageExpected(...descriptor), this.getMessageIs(val, ...descriptor));
        }
        return true;
    }
    /**
     * Assert an arbitrary value to match *any* of of the given conditions.
     *
     * The conditions are tested recursively through their
     * potential {@link Condition.conditions} field.
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     */
    static assert(val, ...descriptor) {
        return descriptor.some(condList => {
            condList = this.#resolveConditionList(condList);
            for (const cond of condList) {
                // TODO check if cond is a Condition (check for object literal & presence of the properties)
                if (cond.conditions) {
                    const res = this.assert(val, ...cond.conditions);
                    if (!res)
                        return res;
                }
            }
            return condList.every(cond => cond.assert(val));
        });
    }
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
    static assertFind(val, ...descriptor) {
        if (this.assert(val, ...descriptor))
            return;
        return this.getMostRelevantFailingCondition(val, ...descriptor);
    }
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
    static getMostRelevantFailingCondition(val, ...descriptor) {
        return this.#getMostRelevantFailingCondition(val, descriptor).failing;
    }
    static #getMostRelevantFailingCondition(val, descriptor, ignoreConditions = []) {
        const max = {
            count: -Infinity,
            failing: undefined
        };
        for (let condList of descriptor) {
            condList = this.#resolveConditionList(condList);
            /** First failing condition of this level. All others are disregarded. */
            let firstFail;
            /** Maximum condition chain count, up to but excluding this level. */
            let maxCount = -Infinity;
            /** Count of exactly this level, accumulated for each asserting condition. */
            let levelCount = 0;
            for (const cond of condList) {
                if (!ignoreConditions.includes(cond)) {
                    ignoreConditions.push(cond);
                    let result = {
                        count: 0,
                        failing: undefined
                    };
                    if (cond.conditions && cond.conditions.length > 0) {
                        result = this.#getMostRelevantFailingCondition(val, cond.conditions, ignoreConditions);
                        // Decrementing by one per depth level, weighting shallow conditions.
                        result.count--;
                    }
                    if (!result.failing) {
                        if (cond.assert(val)) {
                            levelCount += 10;
                        }
                        else {
                            result.failing = cond;
                        }
                    }
                    if (result.count > maxCount) {
                        maxCount = result.count;
                    }
                    firstFail ||= result.failing;
                }
            }
            if ((maxCount + levelCount) > max.count) {
                max.failing = firstFail;
                max.count = maxCount + levelCount;
            }
        }
        return max;
    }
    // ---- "Is" message handling ----
    /**
     * Return the result of {@link getMessageIs} for the first
     * of the passed values that does not assert.
     *
     * @param val An **array** of the values to test.
     * @param descriptor The conditions to test the value against.
     */
    static getMessageIsIterated(val, ...descriptor) {
        for (const item of val) {
            if (!this.assert(item, ...descriptor)) {
                return this.getMessageIs(item, ...descriptor);
            }
        }
    }
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
    static getMessageIs(val, ...descriptor) {
        const condition = this.assertFind(val, ...descriptor);
        if (condition) {
            if (typeof condition.is === 'function') {
                const valueType = this.getType(val);
                return condition.is({
                    type: valueType,
                    val: val,
                    article: this.getArticle(valueType),
                });
            }
            return condition.is;
        }
        return '';
    }
    // ---- "Expected" message handling ----
    /**
     * Return a string denoting the expected type within the passed conditions.
     * The message is created by recursively merging all `shouldBe` fields.
     *
     * @example
     * descriptor 1: `[ Cond.number, Cond.positive ]`
     * descriptor 2: `Cond.keywords("foobar")`
     * Return value: `'positive number OR the keyword "foobar"'`
     */
    static getMessageExpected(...descriptor) {
        const messageList = this.mergeDescriptorMessages(...descriptor);
        const output = messageList
            .map(this.compilePartialMessage)
            .join(' OR ');
        return output;
    }
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
    static compilePartialMessage(messagePartial) {
        let output = '';
        if (messagePartial.before.length > 0) {
            output += messagePartial.before
                .map(str => str.trim())
                .join(', ');
            output += ' ';
        }
        output += (messagePartial.type ?? '<unknown>');
        if (messagePartial.after.length > 0) {
            let hadFirstThat = false;
            output += ' ';
            output += messagePartial.after
                .map(str => str.trim())
                .sort(str => str.startsWith('that') ? 1 : -1)
                .map((str, i) => {
                if (str.startsWith('that')) {
                    if (!hadFirstThat) {
                        hadFirstThat = true;
                    }
                    else {
                        return str.replace('that', 'and');
                    }
                }
                return str;
            })
                .join(' ');
        }
        return output;
    }
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
    static mergeDescriptorMessages(...descriptor) {
        return this.#mergeDescriptorMessagesHelper(descriptor);
    }
    static #mergeDescriptorMessagesHelper(descriptor) {
        if (!descriptor) {
            return [{
                    before: [],
                    type: undefined,
                    after: [],
                }];
        }
        const messageList = [];
        for (let condList of descriptor) {
            condList = this.#resolveConditionList(condList);
            if (condList.length === 0)
                continue;
            const currentMessage = makePartial(condList[0].shouldBe);
            const results = [];
            let hasDeepMessage = false;
            for (let i = 1; i < condList.length; i++) {
                const cond = condList[i];
                mergeMessages(currentMessage, makePartial(cond.shouldBe));
            }
            for (const cond of condList) {
                results.push(this.#mergeDescriptorMessagesHelper(cond.conditions));
            }
            for (const result of results) {
                if (result.length === 1) {
                    mergeMessages(currentMessage, result[0]);
                }
            }
            for (const result of results) {
                if (result.length > 1) {
                    for (const message of result) {
                        mergeMessages(message, currentMessage);
                        messageList.push(message);
                    }
                    hasDeepMessage = true;
                }
            }
            if (!hasDeepMessage) {
                messageList.push(currentMessage);
            }
        }
        // Return result without duplicates
        return messageList.filter((message, i, arr) => {
            for (let j = i + 1; j < arr.length; j++) {
                if (messageIsEqual(message, arr[j])) {
                    return false;
                }
            }
            return true;
        });
        function makePartial(message) {
            return {
                before: message?.before ? [message.before] : [],
                type: message?.type,
                after: message?.after ? [message.after] : [],
            };
        }
        function mergeMessages(target, source) {
            if (source.before)
                target.before.push(...source.before);
            if (source.after)
                target.after.push(...source.after);
            if (!target.type)
                target.type = source.type;
        }
        function messageIsEqual(part1, part2) {
            return arrayIsEqual(part1.before, part2.before)
                && arrayIsEqual(part1.after, part2.after)
                && part1.type === part2.type;
        }
        function arrayIsEqual(val1, val2) {
            return val1.length === val2.length && val1.every((val, i) => val2[i] === val);
        }
    }
    // ---- Helper functions ----
    /**
     * Get the matching indefinite article (a or an) for the passed string.
     *
     * @remarks
     * This method is by no means linguistically sound, it simply checks
     * whether the first character of the passed string is a vowel.
     */
    static getArticle(value) {
        return /^[aeiou]/i.test(value) ? 'an' : 'a';
    }
    /**
     * Get a string list of all items of the passed string array
     * of the style "first, second, third or fourth".
     *
     * @remarks
     * This is used within the {@link RuntimeTypeCheck.Cond.keywords} condition.
     */
    static getPrettyEnumeratedList(list) {
        return list.reduce((acc, word, i) => {
            if (i !== 0 && i === list.length - 1) {
                acc += ' or ';
            }
            else if (i !== 0) {
                acc += ', ';
            }
            return acc + `"${word}"`;
        }, '');
    }
    /**
     * Return the `typeof` of a value with the
     * additional types 'array', 'NaN' and 'null'.
     */
    static getType(value) {
        if (Array.isArray(value))
            return 'array';
        else if (Number.isNaN(value))
            return 'NaN';
        else if (value === null)
            return 'null';
        else
            return typeof value;
    }
    // ---- Internal helpers ----
    /**
     * Return a passed condition list (which can be both an
     * array or a single item) as an ensured array.
     */
    static #resolveConditionList(condList) {
        return Array.isArray(condList) ? condList : [condList];
    }
}
