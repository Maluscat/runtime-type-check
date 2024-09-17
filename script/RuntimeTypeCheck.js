'use strict';
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
    static #conditionTypeof(type) {
        return {
            assert: val => RuntimeTypeCheck.getType(val) === type,
            shouldBe: { type: type },
            is: ({ type }) => type
        };
    }
    static Cond = ({
        typeof: this.#conditionTypeof,
        boolean: this.#conditionTypeof('boolean'),
        function: this.#conditionTypeof('function'),
        number: this.#conditionTypeof('number'),
        string: this.#conditionTypeof('string'),
        array: (...descriptor) => {
            return {
                conditions: [this.#conditionTypeof('array')],
                assert: (val) => descriptor.length > 0
                    ? val.every(inner => this.assert(inner, ...descriptor))
                    : true,
                shouldBe: descriptor.length > 0
                    ? { type: `Array<${this.getMessageExpected(...descriptor)}>` }
                    : { type: 'array' },
                is: ({ val, type }) => {
                    if (type === 'array' && descriptor.length > 0) {
                        if (val.length === 0) {
                            return 'an empty array';
                        }
                        else {
                            return `Array<${this.getMessageIsIterated(val, ...descriptor)}>`;
                        }
                    }
                    else
                        return type;
                }
            };
        },
        object: (keyName, ...descriptor) => {
            if (typeof keyName !== 'string')
                throw new Error(`\
Condition 'object': When passing a descriptor, the first parameter \
needs to be a key name, which is used for displaying "Object<keyName, ...>" in the type message.
(If generic, just use 'string')`);
            return {
                conditions: [this.#conditionTypeof('object')],
                assert: val => descriptor
                    ? Object.values(val).every(inner => this.assert(inner, ...descriptor))
                    : true,
                shouldBe: descriptor
                    ? { type: `Object<${keyName}, ${this.getMessageExpected(...descriptor)}>` }
                    : { type: 'object' },
                is: ({ val, type }) => {
                    if (type === 'object' && descriptor) {
                        if (val.length === 0) {
                            return 'an empty object';
                        }
                        else {
                            return `Object<${this.getMessageIsIterated(Object.values(val), ...descriptor)}>`;
                        }
                    }
                    else
                        return type;
                }
            };
        },
        true: {
            conditions: [this.#conditionTypeof('boolean')],
            assert: val => val === true,
            shouldBe: { type: 'true' },
            is: 'false',
        },
        false: {
            conditions: [this.#conditionTypeof('boolean')],
            assert: val => val === false,
            shouldBe: { type: 'false' },
            is: 'true',
        },
        integer: {
            conditions: [this.#conditionTypeof('number')],
            assert: val => val % 1 === 0,
            shouldBe: { type: 'integer' },
            is: 'a floating point number'
        },
        nonnegative: {
            conditions: [this.#conditionTypeof('number')],
            assert: val => val >= 0,
            shouldBe: { before: 'non-negative' },
            is: 'a negative number'
        },
        positive: {
            conditions: [this.#conditionTypeof('number')],
            assert: val => val > 0,
            shouldBe: { before: 'positive' },
            is: 'a negative number or 0'
        },
        nonempty: {
            conditions: [
                this.#conditionTypeof('array'),
                this.#conditionTypeof('string')
            ],
            assert: val => val.length > 0,
            shouldBe: { before: 'non-empty' },
            is: ({ type, article }) => `${article} empty ${type}`
        },
        keywords: (...keywords) => {
            return {
                conditions: [this.#conditionTypeof('string')],
                assert: val => keywords.includes(val),
                shouldBe: {
                    type: keywords.length > 1
                        ? `one of the keywords ${this.getPrettyEnumeratedList(keywords)}`
                        : `the keyword "${keywords[0]}"`
                },
                is: 'a different string'
            };
        },
        length: (len) => {
            return {
                conditions: [
                    this.#conditionTypeof('array'),
                    this.#conditionTypeof('string')
                ],
                assert: val => val.length === len,
                shouldBe: { after: `of length ${len}` },
                is: ({ type, article }) => `${article} ${type} of a different length`
            };
        },
        range: (min, max) => {
            return {
                conditions: [this.#conditionTypeof('number')],
                assert: val => val >= min && val <= max,
                shouldBe: { after: `of the interval [${min}, ${max}]` },
                is: 'a number outside of the required range'
            };
        }
    });
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
     * conditions, return the failing condition that is the closest
     * to passing, or undefined otherwise.
     *
     * The conditions are tested recursively through their
     * potential {@link Condition.conditions} field.
     *
     * @param val The value to test.
     * @param descriptor The conditions to test the value against.
     */
    static assertFind(val, ...descriptor) {
        let max = -1;
        let maxCondition;
        for (let condList of descriptor) {
            if (this.assert(val, condList))
                return;
            condList = this.#resolveConditionList(condList);
            const assertCount = this.getDescriptorPassCount(val, condList);
            if (assertCount > max) {
                maxCondition = condList;
                max = assertCount;
            }
        }
        return maxCondition?.find(cond => !cond.assert(val));
    }
    /**
     * Recursively count the amount of passing conditions
     * inside a given descriptor and return it.
     *
     * This does *not* check if a descriptor as a whole asserts to true.
     */
    static getDescriptorPassCount(val, ...descriptor) {
        return this.#getDescriptorPassCountHelper(val, descriptor, []);
    }
    static #getDescriptorPassCountHelper(val, descriptor, ignoreConditions = []) {
        let count = 0;
        for (let condList of descriptor) {
            condList = this.#resolveConditionList(condList);
            for (const cond of condList) {
                if (!ignoreConditions.includes(cond)) {
                    ignoreConditions.push(cond);
                    if (cond.conditions) {
                        count += this.#getDescriptorPassCountHelper(val, cond.conditions, ignoreConditions);
                    }
                    count += cond.assert(val) ? 1 : 0;
                }
            }
        }
        return count;
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
        for (let condList of descriptor) {
            condList = this.#resolveConditionList(condList);
            const condition = this.assertFind(val, condList);
            if (!condition)
                continue;
            if (typeof condition.is === 'function') {
                const valueType = this.getType(val);
                return condition.is({
                    type: valueType,
                    val: val,
                    article: this.getArticle(valueType),
                    conditions: condList
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
     * ```ts
     * {
     *   before: [ 'nonverbal', 'positive' ],
     *   type: [ 'integer' ],
     *   after: [ 'that is cool', 'with 6 digits', 'that is divisible by 5' ]
     * }
     * ```
     * Output:
     * `"nonverbal, positive integer with 6 digits that is cool and is divisible by 5"`
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
     * message for a seperate assertion.
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
    /** Uppercase the first character of a passed string. */
    static toTitleCase(str) {
        return str.slice(0, 1).toUpperCase() + str.slice(1);
    }
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
    // ---- Internal type resolvers ----
    /**
     * Return a passed condition list (which can be both an
     * array or a single item) as an ensured array.
     */
    static #resolveConditionList(condList) {
        return Array.isArray(condList) ? condList : [condList];
    }
}
