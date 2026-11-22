import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateAt, median, historicalComparison, sevenDayComparison,
  monthToDateComparison, normaliseItem, validateMockOffers, MOCK_OFFERS,
} from '../../client/src/features/analysis/analysis.js';

test('calendar math handles leap day and month/year crossover', () => {
  assert.equal(dateAt('2024-03-01', -1), '2024-02-29');
  assert.equal(dateAt('2026-01-01', -1), '2025-12-31');
});
test('median resists outliers, normalization trims cosmetic differences', () => {
  assert.equal(median([600,650,700,750,3000]),700);
  assert.equal(normaliseItem('光泉 無糖豆漿 400mL'), normaliseItem('光泉無糖豆漿400ｍＬ'));
});
test('historical rating is blocked until five earlier linked records', () => {
  const expenses = Array.from({length:6},(_,i)=>({id:'r'+i,item:'豆漿',amount:30+i,expenseDate:dateAt('2026-11-10',i),createdAt:'2026-11-22T00:00:00Z'}));
  const links = Object.fromEntries(expenses.map(e=>[e.id,'verified-product']));
  const insufficient = historicalComparison(expenses,links,'r4');
  assert.equal(insufficient.count,4);
  assert.equal(insufficient.rating,null);
  const enough=historicalComparison(expenses,links,'r5');
  assert.equal(enough.count,5);
  assert.equal(enough.reference,32);
  assert.equal(enough.delta,3);
  assert.equal(enough.rating,'接近歷史價格');
  assert.equal(historicalComparison(expenses,{},'r5').rating,null);
});
test('both periods require coverage >=90% for trend rating', () => {
  const expenses=[];
  const today='2026-11-22';
  const dates=Array.from({length:14},(_,i)=>dateAt(today,-i));
  let result=sevenDayComparison(expenses,dates,today);
  assert.equal(result.status,'eligible');
  result=sevenDayComparison(expenses,dates.slice(0,6),today);
  assert.equal(result.status,'insufficient');
  result=sevenDayComparison(expenses,dates.slice(0,12),today);
  assert.equal(result.status,'preliminary');
});
test('month-to-date truncates the longer month to comparable number of calendar days',()=>{
  const result = monthToDateComparison([],[],'2026-03-31');
  assert.equal(result.current.end,'2026-03-28');
  assert.equal(result.previous.end,'2026-02-28');
  assert.equal(result.current.days,result.previous.days);
});
test('market mock stays simulated and deduplicates merchants',()=>{
  const result=validateMockOffers([...MOCK_OFFERS,{...MOCK_OFFERS[0],price:1}],890);
  assert.equal(result.simulated,true);
  assert.equal(result.sampleSize,3);
  assert.equal(result.reference,760);
  assert.equal(result.difference,130);
});
