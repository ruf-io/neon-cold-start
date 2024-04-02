import type { MDXComponents } from 'mdx/types'
import Image, { ImageProps } from 'next/image'

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including inline styles,
// components from other libraries, and more.

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        // Allows customizing built-in components, e.g. to add styling.
        h1: ({ children }) => <h1 className='text-5xl font-bold '>{children}</h1>,
        h2: ({ children }) => <h2 className='text-4xl font-bold '>{children}</h2>,
        p: ({ children }) => <p className='font-light'>{children}</p>,
        img: (props) => (
            <Image
                sizes="100vw"
                style={{ width: '100%', height: 'auto' }}
                {...(props as ImageProps)}
            />
        ),
        li: ({ children }) => <li className='text-gray-400 font-light'>{children}</li>,
        ul: ({ children }) => <ul >{children}</ul>,
        ...components,
    }
}