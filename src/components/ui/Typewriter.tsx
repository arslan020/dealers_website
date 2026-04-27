'use client';

import { useState, useEffect } from 'react';

export function Typewriter({ words }: { words: string[] }) {
    const [index, setIndex] = useState(0);
    const [subIndex, setSubIndex] = useState(0);
    const [blink, setBlink] = useState(true);
    const [reverse, setReverse] = useState(false);

    // Blinking cursor effect
    useEffect(() => {
        const timeout2 = setTimeout(() => {
            setBlink((prev) => !prev);
        }, 500);
        return () => clearTimeout(timeout2);
    }, [blink]);

    // Typing effect
    useEffect(() => {
        if (
            subIndex === words[index].length + 1 &&
            !reverse
        ) {
            const timeoutId = setTimeout(() => {
                setReverse(true);
            }, 2000); // Wait 2s before deleting
            return () => clearTimeout(timeoutId);
        }

        if (subIndex === 0 && reverse) {
            setReverse(false);
            setIndex((prev) => (prev + 1) % words.length);
            return;
        }

        const timeout = setTimeout(() => {
            setSubIndex((prev) => prev + (reverse ? -1 : 1));
        }, Math.max(reverse ? 50 : 100, Math.random() * 150));

        return () => clearTimeout(timeout);
    }, [subIndex, index, reverse, words]);

    return (
        <span className="inline-flex min-h-[1.2em]">
            <span className="text-blue-600">
                {words[index].substring(0, subIndex)}
            </span>
            <span className={`w-1 bg-slate-800 ml-1 ${blink ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}></span>
        </span>
    );
}
