module.exports = (url, method = 'GET', payload) => {
  if (payload)
    return {method: method, url: url, credentials: {authorization: 'Bearer internalCall'}, payload}
  else
    return {method: method, url: url, credentials: {authorization: 'Bearer internalCall'}}
}