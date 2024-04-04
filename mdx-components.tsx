import type { MDXComponents } from 'mdx/types'
import slugify from '@sindresorhus/slugify';


// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including inline styles,
// components from other libraries, and more.

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        // Allows customizing built-in components, e.g. to add styling.
        h1: ({ children }) => <h1 id={slugify(children ? children.toString() : '')}>{children}</h1>,
        h2: ({ children }) => <h2 id={slugify(children ? children.toString() : '')}>{children}</h2>,
        h3: ({ children }) => <h3 id={slugify(children ? children.toString() : '')}>{children}</h3>,
        ...components,
    }
}