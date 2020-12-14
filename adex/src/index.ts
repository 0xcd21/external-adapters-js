import { expose, util } from '@chainlink/ea-bootstrap'
import { execute } from './adapter'

const NAME = 'Adex'

export = { NAME, execute, ...expose(util.wrapExecute(execute)) }
