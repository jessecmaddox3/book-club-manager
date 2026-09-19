#!/usr/bin/env python3
"""Real Supabase Auth + PostgreSQL + built Next application, entirely loopback.

Requires a downloaded, checksum-verified Supabase Auth distribution, PostgreSQL
17 tools, and Python Playwright/Chromium. All identities and stores are invented.
No Docker, hosted project, email delivery, existing DSN, or Auth mock is used.
"""
import argparse,base64,hashlib,hmac,http.client,json,os,shutil,socket,subprocess,tempfile,threading,time,urllib.error,urllib.parse,urllib.request
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
def port():
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
def literal(value):return "'"+str(value).replace("'","''")+"'"
def token(secret,role):
 def encode(value):return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
 body=encode({'alg':'HS256','typ':'JWT'})+b'.'+encode({'role':role,'aud':'authenticated','iat':int(time.time()),'exp':int(time.time())+3600})
 return (body+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body,hashlib.sha256).digest()).rstrip(b'=')).decode()
def wait_http(url,process=None):
 for _ in range(150):
  if process and process.poll() is not None:raise RuntimeError('A harness service stopped before becoming ready.')
  try:
   with urllib.request.urlopen(url,timeout=1) as response:
    if response.status==200:return
  except (OSError,urllib.error.URLError):pass
  time.sleep(.2)
 raise RuntimeError('A loopback harness service did not become ready.')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('auth_distribution',type=Path);args=parser.parse_args()
 auth_dir=args.auth_distribution.resolve();binary=auth_dir/'auth'
 assert binary.is_file() and (auth_dir/'migrations').is_dir(),'Use the complete official Auth distribution.'
 assert not any(p.name!='.env.example' for p in ROOT.glob('.env*')),'Run from a clean checkout without private environment files.'
 bins={name:shutil.which(name) for name in ['initdb','pg_ctl','psql','node']};assert all(bins.values()),'PostgreSQL tools and Node must be on PATH.'
 base_env={key:os.environ[key] for key in ['PATH','TMPDIR','LANG','LC_ALL'] if key in os.environ}
 children=[];gateway=None;pg_started=False;logs=[]
 with tempfile.TemporaryDirectory(prefix='bookclub-auth-') as temporary:
  base=Path(temporary);cluster=base/'postgres';socket_dir=base/'socket';socket_dir.mkdir(mode=0o700)
  pg_port,auth_port,app_port=port(),port(),port();origin=f'http://127.0.0.1:{app_port}'
  database=f'postgresql://test_admin@127.0.0.1:{pg_port}/postgres?sslmode=disable'
  subprocess.run([bins['initdb'],'-D',str(cluster),'-U','test_admin','-A','trust','--no-locale','-E','UTF8'],env=base_env,check=True,capture_output=True)
  sql_args=[bins['psql'],'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket_dir),'-p',str(pg_port),'-U','test_admin','-d','postgres']
  def sql(statement):
   result=subprocess.run(sql_args,input=statement,env=base_env,text=True,capture_output=True,timeout=30)
   if result.returncode:raise RuntimeError('Synthetic database statement failed: '+result.stderr)
   return result.stdout.strip()
  auth_requests=[];gateway_state={'offline':False}
  class Gateway(BaseHTTPRequestHandler):
   def log_message(self,*_args):pass
   def forward(self):
    if not self.path.startswith('/auth/v1/'):
     self.send_error(404);return
    if gateway_state['offline']:
     self.send_error(503);return
    auth_requests.append((self.command,urllib.parse.urlparse(self.path).path))
    connection=http.client.HTTPConnection('127.0.0.1',auth_port,timeout=15)
    try:
     body=self.rfile.read(int(self.headers.get('Content-Length','0')))
     headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection','content-length']}
     connection.request(self.command,self.path[len('/auth/v1'):],body,headers)
     response=connection.getresponse();data=response.read();self.send_response(response.status)
     for key,value in response.getheaders():
      if key.lower() not in ['transfer-encoding','connection','content-length']:self.send_header(key,value)
     self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    except (ConnectionError,OSError):self.send_error(503)
    finally:connection.close()
   do_GET=do_POST=do_PUT=do_DELETE=forward
  def start(command,env,cwd,label):
   log=open(base/(label+'.log'),'w+');logs.append((label,log));process=subprocess.Popen(command,env=env,cwd=cwd,stdout=log,stderr=subprocess.STDOUT);children.append(process);return process
  try:
   subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-l',str(base/'postgres.log'),'-o',f"-k {socket_dir} -p {pg_port} -c listen_addresses='127.0.0.1' -c fsync=off",'-w','start'],env=base_env,check=True,capture_output=True);pg_started=True
   sql('CREATE ROLE postgres NOLOGIN;CREATE SCHEMA auth;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;')
   gateway=ThreadingHTTPServer(('127.0.0.1',0),Gateway);threading.Thread(target=gateway.serve_forever,daemon=True).start();api=f'http://127.0.0.1:{gateway.server_port}'
   secret=base64.urlsafe_b64encode(os.urandom(48)).decode();admin_key=token(secret,'service_role');anon_key=token(secret,'anon')
   auth_env={**base_env,'GOTRUE_API_HOST':'127.0.0.1','PORT':str(auth_port),'API_EXTERNAL_URL':api+'/auth/v1','GOTRUE_SITE_URL':origin,'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':database+'&search_path=auth','GOTRUE_DB_NAMESPACE':'auth','GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_EXP':'120','GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_DISABLE_SIGNUP':'true','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'true','GOTRUE_LOG_LEVEL':'error'}
   auth=start([str(binary)],auth_env,auth_dir,'auth');wait_http(api+'/auth/v1/health',auth)
   def provision(name,spoof=False):
    body={'email':name+'@example.invalid','password':'Invented-test-password-846!','email_confirm':True,'user_metadata':{'role':'admin'} if spoof else {}}
    request=urllib.request.Request(api+'/auth/v1/admin/users',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+admin_key},method='POST')
    with urllib.request.urlopen(request) as response:return json.load(response)['id']
   subjects={name:provision(name,name=='reader') for name in ['organizer','reader','unlinked','former']}
   env={**base_env,'BOOKCLUB_MODE':'production','PORT':str(app_port),'BOOKCLUB_ORIGIN':origin,'DATABASE_URL':database,'SUPABASE_URL':api,'SUPABASE_PUBLISHABLE_KEY':anon_key,'SESSION_SECRET':base64.urlsafe_b64encode(os.urandom(48)).decode(),'NEXT_TELEMETRY_DISABLED':'1'}
   organizer=base/'organizer.json';organizer.write_text(json.dumps({'fullName':'Invented Organizer','displayName':'Organizer','authSubject':subjects['organizer']}));organizer.chmod(0o600)
   setup=[bins['node'],'--import','tsx','scripts/setup.ts','init','--organizer',str(organizer)]
   preview=subprocess.run(setup,env=env,cwd=ROOT,text=True,capture_output=True);assert preview.returncode==0,preview.stderr
   assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")=='0','Dry run changed the database.'
   initialized=subprocess.run(setup+['--yes'],env=env,cwd=ROOT,text=True,capture_output=True);assert initialized.returncode==0,initialized.stderr
   owner=json.loads(initialized.stdout)['memberId']
   recovered=subprocess.run([bins['node'],'--import','tsx','scripts/setup.ts','status'],env=env,cwd=ROOT,text=True,capture_output=True);assert recovered.returncode==0,recovered.stderr
   assert json.loads(recovered.stdout)['organizers'][0]['id']==owner
   env['BOOKCLUB_OWNER_MEMBER_ID']=owner
   repeated=subprocess.run(setup+['--yes'],env=env,cwd=ROOT,text=True,capture_output=True);assert repeated.returncode!=0 and 'already_initialized' in repeated.stderr
   members={'organizer':owner}
   for name in ['reader','former']:
    members[name]=sql(f"INSERT INTO members(full_name,display_name,role) VALUES({literal('Invented '+name)},{literal(name.title())},'member') RETURNING id;")
    plan=base/(name+'-link.json');plan.write_text(json.dumps({'memberId':members[name],'expectedRevision':1,'expectedAuthSubject':None,'authSubject':subjects[name]}));plan.chmod(0o600)
    linked=subprocess.run([bins['node'],'--import','tsx','scripts/setup.ts','link-member','--plan',str(plan),'--yes'],env=env,cwd=ROOT,text=True,capture_output=True);assert linked.returncode==0,linked.stderr
   sql(f"UPDATE members SET role='former',revision=revision+1 WHERE id={literal(members['former'])};")
   app=start([bins['node'],'--import','tsx','scripts/serve.ts'],env,ROOT,'app');wait_http(origin+'/login',app)
   print('Real Auth running; empty-club initialization and explicit identity links pass.',flush=True)
   with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True);context=browser.new_context();outside=[]
    def route(request):
     if request.request.url.startswith(origin+'/'):request.continue_()
     else:outside.append(request.request.url);request.abort()
    context.route('**/*',route);page=context.new_page()
    def login(name,password='Invented-test-password-846!',expected=200):
     page.goto(origin+'/login');page.get_by_label('Email',exact=True).fill(name+'@example.invalid');page.get_by_label('Password',exact=True).fill(password)
     with page.expect_response(lambda r:r.url==origin+'/api/auth/login' and r.request.method=='POST') as event:page.get_by_role('button',name='Sign in',exact=True).click()
     assert event.value.status==expected,(name,event.value.status,event.value.text())
     if expected==200:page.wait_for_url(origin+'/')
     else:assert not [c for c in context.cookies() if c['name'].startswith('book-club-auth')]
    def post(path,body=None,actor=None,extra=None):
     return page.evaluate('''async ({path,body,actor,extra})=>{const headers={...(body?{'Content-Type':'application/json'}:{}),...(actor?{'x-bookclub-actor':actor}:{}),...extra};const r=await fetch(path,{method:'POST',headers,body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.text()}}''',{'path':path,'body':body,'actor':actor,'extra':extra or {}})
    login('organizer','wrong-password',401);login('unlinked',expected=403);login('former',expected=403)
    login('reader');assert 'Organizer' not in page.locator('nav').inner_text()
    cookies=[c for c in context.cookies() if c['name'].startswith('book-club-auth')];assert cookies and all(c['httpOnly'] and c['sameSite']=='Lax' for c in cookies)
    assert post('/api/admin/members',{'action':'create','fullName':'Must Not Exist'},members['reader'])['status']==403
    assert post('/api/books/nominate',{'title':'Stale Identity','author':'Invented'},owner)['status']==409
    assert post('/api/auth/logout',actor=owner)['status']==409
    login('organizer');assert post('/api/auth/logout',actor=members['reader'])['status']==409
    login('reader')
    assert post('/api/auth/logout',actor=members['reader'])['status']==200
    assert not [c for c in context.cookies() if c['name'].startswith('book-club-auth')]
    login('organizer');old=context.cookies();before=sum(path=='/auth/v1/token' for _,path in auth_requests)
    print('Password rejection, unlinked/former rejection, spoofed metadata, stale identity and logout pass. Waiting for a real token to expire.',flush=True)
    # Auth issues 120-second access tokens (longer than auth-js's 90-second
    # early-refresh margin). Let the actual token expire, then
    # require the proxy and server render to share the new provider session.
    for _ in range(4):time.sleep(31)
    page.goto(origin+'/');assert page.url==origin+'/'
    assert sum(path=='/auth/v1/token' for _,path in auth_requests)>before,'No real refresh request reached Auth.'
    assert context.cookies()!=old,'Refresh cookies did not reach the browser.'
    sql(f"UPDATE members SET role='member',revision=revision+1 WHERE id={literal(owner)};")
    assert post('/api/admin/members',{'action':'create','fullName':'Must Not Exist'},owner)['status']==403
    sql(f"UPDATE members SET role='former',revision=revision+1 WHERE id={literal(owner)};")
    assert post('/api/books/nominate',{'title':'Must Not Exist','author':'Invented'},owner)['status']==401
    assert post('/api/auth/logout',actor=owner)['status']==200
    assert not [c for c in context.cookies() if c['name'].startswith('book-club-auth')]
    login('reader');sql(f"UPDATE members SET auth_subject=NULL,revision=revision+1 WHERE id={literal(members['reader'])};")
    page.goto(origin+'/');assert '/login' in page.url
    assert post('/api/auth/logout',actor=members['reader'])['status']==200
    context.add_cookies([{'name':'book-club-auth','value':'base64-forged-session','url':origin,'httpOnly':True,'sameSite':'Lax'}]);page.goto(origin+'/');assert '/login' in page.url
    forged=post('/api/auth/login',{'memberId':owner});assert forged['status']==400
    cross=context.request.post(origin+'/api/auth/login',headers={'Origin':'https://outside.invalid'},data={'email':'reader@example.invalid','password':'Invented-test-password-846!'});assert cross.status==403
    host=context.request.get(origin+'/login',headers={'Host':'outside.invalid'});assert host.status==400
    sql(f"UPDATE members SET auth_subject={literal(subjects['reader'])},revision=revision+1 WHERE id={literal(members['reader'])};")
    login('reader');gateway_state['offline']=True
    assert post('/api/auth/logout',actor=members['reader'])['status']==200
    assert not [c for c in context.cookies() if c['name'].startswith('book-club-auth')]
    gateway_state['offline']=False;page.goto(origin+'/');assert '/login' in page.url
    assert not outside,outside
    browser.close()
   assert sql("SELECT count(*) FROM books WHERE title='Must Not Exist'")=='0'
   print(json.dumps({'realAuth':'Supabase Auth','productionSetup':True,'passwordAndMembership':True,'expiredTokenRefresh':True,'liveRoleAndUnlinkRevocation':True,'revokedMemberLogout':True,'forgedIdentityRejected':True,'sameOriginAndHost':True,'outsideBrowserRequests':0}),flush=True)
  except Exception:
   # Logs stay local and are not printed, because providers may include tokens.
   diagnostics=Path(tempfile.mkdtemp(prefix='bookclub-auth-diagnostics-'))
   for label,log in logs:log.flush();shutil.copyfile(log.name,diagnostics/(label+'.log'));(diagnostics/(label+'.log')).chmod(0o600)
   print('Private diagnostic logs saved to '+str(diagnostics),flush=True)
   raise
  finally:
   for process in reversed(children):
    if process.poll() is None:
     process.terminate()
     try:process.wait(timeout=10)
     except subprocess.TimeoutExpired:process.kill();process.wait()
   if gateway:gateway.shutdown();gateway.server_close()
   if pg_started:subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-m','immediate','-w','stop'],env=base_env,capture_output=True)
   for _,log in logs:log.close()

if __name__=='__main__':main()
