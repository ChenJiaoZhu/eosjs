/* eslint-env mocha */
const assert = require('assert')

const Eos = require('.')

const forceMessageDataHex = true, debug = true

// even transactions that don't broadcast require Api lookups
//  no testnet yet, avoid breaking travis-ci
if(process.env['NODE_ENV'] === 'development') {

  describe('networks', () => {
    it('testnet', (done) => {
      eos = Eos.Testnet()
      eos.getBlock(1, (err, block) => {
        if(err) {
          throw err
        }
        done()
      })
    })
  })

  describe('transactions', () => {
    const wif = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
    const signProvider = ({sign, buf}) => sign(buf, wif)
    const promiseSigner = (args) => Promise.resolve(signProvider(args))

    it('usage', () => {
      eos = Eos.Testnet({signProvider})
      eos.transfer()
    })

    it('keyProvider', () => {
      // Ultimatly keyProvider should return a string or array of private keys.
      // Optionally use a function and(or) return a promise if needed.
      // This is the more advanced case.
      const keyProvider = ({transaction}) => {
        assert.equal(transaction.messages[0].type, 'transfer')
        return Promise.resolve(wif)
      }

      eos = Eos.Testnet({keyProvider})

      return eos.transfer('inita', 'initb', 1, '', false).then(tr => {
        assert.equal(tr.transaction.signatures.length, 1)
        assert.equal(typeof tr.transaction.signatures[0], 'string')
      })
    })

    it('signProvider', () => {
      const customSignProvider = ({buf, sign, transaction}) => {

        // All potential keys (EOS6MRy.. is the pubkey for 'wif')
        const pubkeys = ['EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV']

        return eos.getRequiredKeys(transaction, pubkeys).then(res => {
          // Just the required_keys need to sign 
          assert.deepEqual(res.required_keys, pubkeys)
          return sign(buf, wif) // return hex string signature or array of signatures
        })
      }
      eos = Eos.Testnet({signProvider: customSignProvider})
      return eos.transfer('inita', 'initb', 2, '', false)
    })

    it('newaccount', () => {
      eos = Eos.Testnet({signProvider})
      const pubkey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'
      // const auth = {threshold: 1, keys: [{key: pubkey, weight: 1}], accounts: []}
      const name = randomName()

      return eos.newaccount({
        creator: 'inita',
        name,
        owner: pubkey,
        active: pubkey,
        recovery: 'inita',
        deposit: '1 EOS'
      })
    })

    it('transfer (broadcast)', () => {
      eos = Eos.Testnet({signProvider})
      return eos.transfer('inita', 'initb', 1, '')
    })

    it('transfer (no broadcast)', () => {
      eos = Eos.Testnet({signProvider})
      return eos.transfer('inita', 'initb', 1, '', {broadcast: false})
    })

    it('transfer (no broadcast, no sign)', () => {
      eos = Eos.Testnet({signProvider})
      const opts = {broadcast: false, sign: false}
      return eos.transfer('inita', 'initb', 1, '', opts).then(tr => 
        assert.deepEqual(tr.transaction.signatures, [])
      )
    })

    it('transfer sign promise (no broadcast)', () => {
      eos = Eos.Testnet({signProvider: promiseSigner})
      return eos.transfer('inita', 'initb', 1, '', false)
    })

    it('message to contract', () => {
      // eos is a bad test case, but it was the only native contract
      const name = 'eos'
      return Eos.Testnet({signProvider}).contract(name, eos => {
        eos.transfer('inita', 'initd', 1, '')
        eos.transfer('inita', 'inite', 1, '')
      })
    })

    it('message to unknown contract', () => {
      const name = randomName()
      return Eos.Testnet({signProvider}).contract(name).catch(error => {
        assert.equal('unknown key', error.message)
      })
    })

    it('multi-message transaction (broadcast)', () => {
      eos = Eos.Testnet({signProvider})
      return eos.transaction(tr =>
        {
          tr.transfer('inita', 'initb', 1, '')
          tr.transfer({from: 'inita', to: 'initc', amount: 1, memo: ''})
        }
      )
    })

    it('multi-message transaction no inner callback', () => {
      eos = Eos.Testnet({signProvider})
      eos.transaction(tr => {
        tr.okproducer('inita', 'inita', 1, cb => {})
      })
      .then(() => {throw 'expecting rollback'})
      .catch(error => {
        assert(/Callback during a transaction/.test(error), error)
      })
    })

    it('multi-message transaction error rollback', () => {
      eos = Eos.Testnet({signProvider})
      return eos.transaction(tr => {throw 'rollback'})
      .then(() => {throw 'expecting rollback'})
      .catch(error => {
        assert(/rollback/.test(error), error)
      })
    })

    it('multi-message transaction Promise.reject rollback', () => {
      eos = Eos.Testnet({signProvider})
      eos.transaction(tr => Promise.reject('rollback'))
      .then(() => {throw 'expecting rollback'})
      .catch(error => {
        assert(/rollback/.test(error), error)
      })
    })

    it('custom transfer', () => {
      eos = Eos.Testnet({signProvider})
      return eos.transaction(
        {
          scope: ['inita', 'initb'],
          messages: [
            {
              code: 'eos',
              type: 'transfer',
              data: {
                from: 'inita',
                to: 'initb',
                amount: '13',
                memo: '爱'
              },
              authorization: [{
                account: 'inita',
                permission: 'active'
              }]
            }
          ]
        },
        {broadcast: false}
      )
    })

  })

} // if development

const randomName = () => 'a' +
  String(Math.round(Math.random() * 1000000000)).replace(/[0,6-9]/g, '')

