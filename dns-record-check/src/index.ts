import { expose, util } from '@chainlink/ea-bootstrap'
import { makeExecute } from './adapter'

const NAME = 'Adex'

export = { NAME, execute: makeExecute, ...expose(util.wrapExecute(makeExecute())) }
