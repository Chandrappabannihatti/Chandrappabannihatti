export function removeJsonContentType(headers, data) {
  if (typeof FormData === 'undefined' || !(data instanceof FormData)) return headers
  if (typeof headers?.delete === 'function') headers.delete('Content-Type')
  else if (headers) {
    delete headers['Content-Type']
    delete headers['content-type']
  }
  return headers
}
