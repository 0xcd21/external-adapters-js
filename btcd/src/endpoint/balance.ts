import { Account } from '@chainlink/types'
import { BigNumber } from 'ethers'
import { balance } from '@chainlink/ea-factories'
import { Requester } from '@chainlink/external-adapter'
import { BtcdConfig } from '../config'

export const NAME = 'balance'

interface Transaction {
  vin: {
    coinbase?: string
    prevOut?: {
      addresses: string[]
      value: number
    }
  }[]
  vout: {
    value: number
    scriptPubKey: {
      addresses: string[]
    }
  }[]
  confirmations: number
}

export const getBalance: balance.GetBalance = async (account, config) => {
  const confirmations = config.confirmations || 6
  const txs = (await searchRawTxs(account, config)).filter(
    (tx) => tx.confirmations >= confirmations,
  )
  const txsOut = txs
    .filter((tx) =>
      tx.vin.filter((vin) => vin.prevOut && vin.prevOut.addresses.indexOf(account.address) >= 0),
    )
    .map((tx) => tx.vin.map((vin) => BigNumber.from(vin.prevOut?.value)))
    .flat() as BigNumber[]

  const txsIn = txs
    .filter((tx) =>
      tx.vout.filter((vout) => vout.scriptPubKey.addresses.indexOf(account.address) >= 0),
    )
    .map((tx) => tx.vout.map((vout) => BigNumber.from(vout.value)))
    .flat() as BigNumber[]

  const totalOut = txsOut.reduce((sum, out) => sum.add(out), BigNumber.from(0))
  const totalIn = txsIn.reduce((sum, inn) => sum.add(inn), BigNumber.from(0))
  const bal = totalIn.sub(totalOut).toString()

  return {
    result: [
      {
        ...account,
        balance: bal,
      },
    ],
    payload: [txs],
  }
}

const searchRawTxs = async (
  account: Account,
  config: balance.BalanceConfig,
): Promise<Transaction[]> => {
  const allTxs = []
  let skip = 0
  const count = 100
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const txs = await queryRawTx(account, config, skip, count)
    allTxs.push(...txs)
    if (txs.length < count) break
    skip += txs.length
  }
  return allTxs
}

const queryRawTx = async (
  account: Account,
  config: balance.BalanceConfig,
  skip: number,
  count: number,
): Promise<Transaction[]> => {
  const reqConfig = {
    ...config.api,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      jsonrpc: '2.0',
      method: 'searchrawtransactions',
      params: {
        address: account.address,
        skip,
        count,
      },
      id: '1',
    },
  }
  const response = await Requester.request(reqConfig)
  return response.data.result
}

export const makeExecute = (config: BtcdConfig) =>
  balance.make({
    ...config,
    getBalance,
    isSupported: (coin, chain) => coin === config.coin && chain === config.chain,
  })