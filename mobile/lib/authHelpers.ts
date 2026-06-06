export function parseAuthCallbackParams(url: string): URLSearchParams {
  const parsedUrl = new URL(url)
  const params = new URLSearchParams(parsedUrl.search)

  if (parsedUrl.hash.length > 1) {
    const hashParams = new URLSearchParams(parsedUrl.hash.slice(1))
    hashParams.forEach((value, key) => {
      params.set(key, value)
    })
  }

  return params
}
