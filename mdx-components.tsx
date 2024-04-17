import type { MDXComponents } from 'mdx/types'
import slugify from '@sindresorhus/slugify'
import {codeToHtml} from 'shiki'
import { transformerNotationHighlight, transformerNotationFocus } from '@shikijs/transformers'

async function Pre({ children }: any) {
    const html = await codeToHtml(children.props.children, {
        lang: children.props.className.replace('language-', ''),
        theme: 'andromeeda',
        transformers: [
          transformerNotationHighlight(),
          transformerNotationFocus(),
        ],
      })
    
      return <p dangerouslySetInnerHTML={{ __html: html }} />
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        // Allows customizing built-in components, e.g. to add styling.
        h1: ({ children }) => <h1 id={slugify(children ? children.toString() : '')}>{children}</h1>,
        h2: ({ children }) => <h2 id={slugify(children ? children.toString() : '')}>{children}</h2>,
        h3: ({ children }) => <h3 id={slugify(children ? children.toString() : '')}>{children}</h3>,
        pre: Pre,
        ...components,
    }
}