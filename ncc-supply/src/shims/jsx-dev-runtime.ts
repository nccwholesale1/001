/**
 * Production React's `jsx-dev-runtime` can export `jsxDEV` in a shape the
 * Nitro CJS interop cannot call (`(0, import_jsx_dev_runtime.jsxDEV) is not
 * a function`). Map it onto the production `jsx` runtime so Vercel SSR and
 * `/_serverFn` requests do not 500.
 */
export { Fragment, jsx, jsxs } from 'react/jsx-runtime'
export { jsx as jsxDEV } from 'react/jsx-runtime'
