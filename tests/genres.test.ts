import test from 'node:test';import assert from 'node:assert/strict';
import {validateGenreAnswers} from '../src/lib/predict/genres';
const book={bookId:'10000000-0000-4000-8000-000000000001',title:'Invented Book',author:'Invented Writer',genre:null};
test('genre provider replies must use the exact catalog IDs and vocabulary',()=>{
 assert.deepEqual(validateGenreAnswers([{bookId:book.bookId,genre:'mystery'}],[book]),[{bookId:book.bookId,genre:'mystery',expectedGenre:null}]);
 for(const input of [[],[{bookId:book.bookId,genre:'made-up'}],[{bookId:'10000000-0000-4000-8000-000000000002',genre:'mystery'}],[{bookId:book.bookId,genre:'mystery'},{bookId:book.bookId,genre:'mystery'}]])assert.throws(()=>validateGenreAnswers(input,[book]));
});
