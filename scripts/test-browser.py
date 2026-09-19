#!/usr/bin/env python3
"""Offline browser tour with invented records and a temporary generated cover."""
import json,os,re,shutil,socket,subprocess,tempfile,time,urllib.request,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def tour(origin,cover_path,artifacts):
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  context=browser.new_context(viewport={'width':1280,'height':900})
  external=[];errors=[]
  def route(r):
   if r.request.url.startswith(origin+'/'):r.continue_()
   else:external.append(r.request.url);r.abort()
  context.route('**/*',route)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(origin+'/books');page.wait_for_url('**/login')
  page.get_by_role('button',name='Explore the club',exact=True).click();page.wait_for_url(origin+'/')
  assert page.get_by_role('heading',name='Lantern Reading Room',exact=True).is_visible()
  pages=['/books','/books/rate','/books/also-rans','/meetings','/meetings/1','/members','/predictions','/predictions/2034','/predictions/2035','/survey','/survey/results','/survey/admin','/admin','/admin/members','/admin/meetings','/books/submit','/books/recommend']
  for path in pages:
   response=page.goto(origin+path);assert response and response.status==200,(path,response.status if response else None)
   assert page.locator('h1').count()>0,path
   assert 'Application error' not in page.locator('body').inner_text(),path
  page.goto(origin+'/members');href=page.locator('a[href^="/members/"]').first.get_attribute('href');page.goto(origin+href);assert page.locator('h1').count()>0
  page.goto(origin+'/books');cover=page.locator('img[src$="'+cover_path+'"]').first
  cover.wait_for(state='visible')
  page.wait_for_function("(src)=>Array.from(document.images).some(image=>image.getAttribute('src').endsWith(src)&&image.complete&&image.naturalWidth>0)",arg=cover_path)
  page.goto(origin+'/survey')
  for button in page.get_by_role('button',name="5 stars: Let's read it",exact=True).all():button.click()
  with page.expect_response(lambda r:r.url.endswith('/api/survey') and r.request.method=='POST') as saved:page.get_by_role('button',name=re.compile('Submit my vote|Update my vote')).click()
  response=saved.value;assert response.status==200,(response.status,response.text());assert response.json()['revision']>=1
  page.reload();assert page.get_by_text('Your vote is in',exact=True).is_visible()
  page.goto(origin+'/books/rate')
  with page.expect_response(lambda r:r.url.endswith('/api/ratings') and r.request.method=='POST') as saved:page.get_by_role('button',name='Clear verdict',exact=True).first.click()
  assert saved.value.status==200,saved.value.text()
  page.reload();assert page.get_by_role('heading',name=re.compile(r'Still owed \(')).is_visible()
  page.goto(origin+'/books/submit');page.get_by_label('Book title',exact=True).fill('An Invented Browser Book');page.get_by_label('Author',exact=True).fill('Sample Writer');page.get_by_role('button',name='Preview book',exact=True).click()
  with page.expect_response(lambda r:r.url.endswith('/api/books/nominate') and r.request.method=='POST') as saved:page.get_by_role('button',name='Nominate',exact=True).click()
  assert saved.value.status==200,saved.value.text()
  page.reload();assert page.get_by_text('An Invented Browser Book',exact=True).is_visible()
  page.goto(origin+'/admin/meetings');page.get_by_role('button',name='Meeting notes',exact=True).first.click();page.get_by_role('textbox').first.fill('A fictional note saved in the browser.')
  with page.expect_response(lambda r:r.url.endswith('/api/admin/meetings') and r.request.method=='POST') as saved:page.get_by_role('button',name='Save notes',exact=True).first.click()
  assert saved.value.status==200,saved.value.text()
  page.goto(origin+'/meetings/5');assert page.get_by_text('A fictional note saved in the browser.',exact=True).is_visible()
  for width in [1440,1024,768,390]:
   page.set_viewport_size({'width':width,'height':1000})
   for path in ['/survey','/books/submit','/members','/admin/members','/survey/admin']:
    page.goto(origin+path)
    page.screenshot(path=str(artifacts/f"{path.strip('/').replace('/','-')}-{width}.png"),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(path,width)
  assert not external,external
  assert not errors,errors
  print(json.dumps({'pages':len(pages)+3,'ballotSaved':True,'ratingCleared':True,'manualNomination':True,'meetingNotes':True,'externalRequests':external,'browserErrors':errors}))
  browser.close()

def main():
 assert not any(p.name!='.env.example' for p in ROOT.glob('.env*')),'Run from a clean checkout without private environments.'
 artifacts=ROOT/'artifacts/browser';artifacts.mkdir(parents=True,exist_ok=True)
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 origin=f'http://127.0.0.1:{port}';cover_name='test-'+uuid.uuid4().hex+'.png';covers=ROOT/'public/covers';covers.mkdir(exist_ok=True)
 cover=covers/cover_name;shutil.copyfile(ROOT/'docs/assets/book-club-manager-hero.png',cover)
 with tempfile.TemporaryDirectory(prefix='bookclub-browser-') as temporary:
  base=Path(temporary);env={key:os.environ[key] for key in ['PATH','TMPDIR','LANG','LC_ALL','SYSTEMROOT'] if key in os.environ}
  env.update(BOOKCLUB_MODE='demo',BOOKCLUB_DATA_DIR=str(base/'data'),BOOKCLUB_ORIGIN=origin,PORT=str(port),NEXT_TELEMETRY_DISABLED='1',TEST_COVER='/covers/'+cover_name)
  initialize="const {withOwner}=require('./src/lib/runtime/owner.ts');withOwner(async r=>{await r.db.query('UPDATE books SET cover_image_url=$1 WHERE title=$2',[process.env.TEST_COVER,'The Lantern Atlas'])}).catch(e=>{console.error(e);process.exitCode=1})"
  process=None
  try:
   subprocess.run(['node','--import','tsx','-e',initialize],cwd=ROOT,env=env,check=True,capture_output=True,text=True)
   with (base/'server.log').open('w+') as log:
    process=subprocess.Popen(['node','--import','tsx','scripts/serve.ts','--demo'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
    for _ in range(180):
     if process.poll() is not None:log.seek(0);raise RuntimeError(log.read())
     try:
      with urllib.request.urlopen(origin+'/login',timeout=2) as response:
       if response.status==200:break
     except OSError:time.sleep(.3)
    else:raise RuntimeError('Demo did not start.')
    tour(origin,env['TEST_COVER'],artifacts)
    process.terminate();process.wait(timeout=20);process=None
    inspect="const assert=require('node:assert/strict');const {withOwner}=require('./src/lib/runtime/owner.ts');withOwner(async r=>{assert.equal((await r.db.query('SELECT count(*)::int AS n FROM books WHERE title=$1',['An Invented Browser Book']))[0].n,1);assert.equal((await r.db.query('SELECT notes FROM meetings WHERE number=5'))[0].notes,'A fictional note saved in the browser.')}).catch(e=>{console.error(e);process.exitCode=1})"
    subprocess.run(['node','--import','tsx','-e',inspect],cwd=ROOT,env=env,check=True,capture_output=True,text=True)
    print('Saved nomination and meeting notes survived a clean database restart.')
  finally:
   if process is not None:process.terminate();process.wait(timeout=20)
   cover.unlink(missing_ok=True)
   try:covers.rmdir()
   except OSError:pass
if __name__=='__main__':main()
