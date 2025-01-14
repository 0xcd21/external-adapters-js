import { Requester, Validator } from '@chainlink/ea-bootstrap'
import { AdapterRequest, AdapterResponse, Config, MakeWSHandler } from '@chainlink/types'
import IntrinioRealtime from 'intrinio-realtime'
import { makeConfig, NAME } from './config'

export const customParams = {
  base: ['base', 'from', 'asset'],
}

export const execute = async (input: AdapterRequest, config: Config) => {
  const validator = new Validator(input, customParams)
  if (validator.error) throw validator.error

  const jobRunID = validator.validated.id
  const symbol = validator.validated.data.base.toUpperCase()

  const url = `securities/${symbol}/prices/realtime`
  const params = {
    api_key: config.apiKey,
  }

  const request = {
    ...config.api,
    url,
    params,
  }

  const response = await Requester.request(request)
  response.data.result = Requester.validateResultNumber(response.data, ['last_price'])

  return Requester.success(jobRunID, response)
}

export const makeExecute = (config?: Config) => {
  return async (request: AdapterRequest) => execute(request, config || makeConfig())
}

export const makeWSHandler = (config?: Config): MakeWSHandler => {
  // https://github.com/intrinio/intrinio-realtime-node-sdk

  const getBase = (input: AdapterRequest): string => {
    const validator = new Validator(input, customParams)
    if (validator.error) {
      return ''
    }
    return (validator.overrideSymbol(NAME) as string).toUpperCase()
  }

  return async () => {
    const defaultConfig = config || makeConfig()

    const ws = new IntrinioRealtime({
      api_key: defaultConfig.apiKey,
      provider: 'iex',
    })

    await ws._refreshToken()
    ws.destroy() // close WS connection generated by the Intrinio SDK to prevent unmaintained connections

    return {
      connection: {
        url: ws._makeSocketUrl(),
      },
      subscribe: (input) => ws._makeJoinMessage(getBase(input)),
      unsubscribe: (input) => ws._makeLeaveMessage(getBase(input)),
      subsFromMessage: (message) => ws._makeJoinMessage(message.payload.ticker),
      isError: (message: any) => Number(message.TYPE) > 400 && Number(message.TYPE) < 900,
      filter: (message) => message.event == 'quote' && message.payload?.type == 'last',
      toResponse: (wsResponse: any): AdapterResponse =>
        Requester.success(undefined, { data: { result: wsResponse?.payload?.price } }),
    }
  }
}
