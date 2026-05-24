import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { decimalToMinorUnits } from '@/modules/accounting/money'
import { assertBalancedMinorLines } from '@/services/erp/money.service'
import { STANDARD_AGENCY_ACCOUNTS } from '@/services/erp/standard-agency-coa'

test('decimalToMinorUnits stores USD in cents without floats', () => {
  assert.equal(decimalToMinorUnits(new Prisma.Decimal('123.45'), 'USD').toString(), '12345')
})

test('decimalToMinorUnits rejects precision below the currency minor unit', () => {
  assert.throws(() => decimalToMinorUnits(new Prisma.Decimal('10.005'), 'USD'), /more precision/)
})

test('assertBalancedMinorLines accepts balanced double-entry lines', () => {
  const totals = assertBalancedMinorLines([
    { debitMinor: BigInt(12500), creditMinor: BigInt(0) },
    { debitMinor: BigInt(0), creditMinor: BigInt(12500) },
  ])

  assert.equal(totals.debitMinor, BigInt(12500))
  assert.equal(totals.creditMinor, BigInt(12500))
})

test('assertBalancedMinorLines rejects unbalanced journal entries', () => {
  assert.throws(
    () =>
      assertBalancedMinorLines([
        { debitMinor: BigInt(12500), creditMinor: BigInt(0) },
        { debitMinor: BigInt(0), creditMinor: BigInt(12499) },
      ]),
    /out of balance/
  )
})

test('standard agency chart contains one unique code per account', () => {
  const codes = STANDARD_AGENCY_ACCOUNTS.map((account) => account.code)
  assert.equal(new Set(codes).size, codes.length)
  assert.ok(codes.includes('1100'))
  assert.ok(codes.includes('2300'))
  assert.ok(codes.includes('3100'))
})
