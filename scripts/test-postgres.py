#!/usr/bin/env python3
"""Run production-style races in a fresh private Unix-socket PostgreSQL cluster.

No inherited DSN, TCP listener, credentials or existing database is used.
"""
from concurrent.futures import ThreadPoolExecutor
import json,os,shutil,subprocess,tempfile,time,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ADMIN='10000000-0000-4000-8000-000000000001'
READER='10000000-0000-4000-8000-000000000002'
def literal(value):return "'"+str(value).replace("'","''")+"'"
def data(value):return literal(json.dumps(value))+'::jsonb'
def main():
 bins={name:shutil.which(name) for name in ('postgres','initdb','pg_ctl','psql')}
 if not all(bins.values()):raise SystemExit('Install PostgreSQL 17 and put its executables on PATH.')
 version=subprocess.check_output([bins['postgres'],'--version'],text=True).strip()
 if not version.startswith('postgres (PostgreSQL) 17.'):raise SystemExit('This harness requires PostgreSQL17; found '+version)
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 with tempfile.TemporaryDirectory(prefix='club-pg-') as temporary:
  base=Path(temporary);cluster=base/'data';socket=base/'socket';socket.mkdir(mode=0o700)
  subprocess.run([bins['initdb'],'-D',str(cluster),'-U','test_admin','-A','trust','--no-locale','-E','UTF8'],env=env,check=True,capture_output=True)
  subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-l',str(base/'server.log'),'-o',f"-k {socket} -c listen_addresses='' -c fsync=off",'-w','start'],env=env,check=True,capture_output=True)
  args=[bins['psql'],'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-U','test_admin','-d','postgres']
  def query(sql,fails=False):
   r=subprocess.run(args,input=sql,env=env,text=True,capture_output=True,timeout=30)
   if fails:assert r.returncode!=0,'Expected rejection: '+sql;return r.stderr
   assert r.returncode==0,r.stderr
   return r.stdout.strip()
  def command(name,values):return 'SELECT '+name+'('+','.join(values)+');'
  def draft(number):
   definition={'meetingNumber':number,'dates':['2035-05-08'],'nominees':[{'slug':'paper-island','title':'Paper Island','author':'Imaginary One','recommendedBy':ADMIN,'description':'An invented map story.'},{'slug':'clock-orchard','title':'Clock Orchard','author':'Imaginary Two','recommendedBy':READER,'description':'An invented garden story.'}]}
   b=json.loads(query(command('club_replace_draft',[literal(ADMIN),'0',data(definition)])))
   return json.loads(query(command('club_open_ballot',[literal(ADMIN),literal(b['id']),str(b['revision'])])))
  def vote(b):return command('club_submit_survey',[literal(READER),literal(b['id']),str(b['revision']),'0',data({'paper-island':4,'clock-orchard':2}),data({'2035-05-08':'yes'}),'true','false','NULL'])
  def close(b,responses=0):
   book=query(f"SELECT book_id FROM ballot_nominees WHERE ballot_id={literal(b['id'])} AND slug='paper-island';")
   payload={'ballotId':b['id'],'revision':b['revision'],'responsesRevision':responses,'selectedBookId':book,'date':'2035-05-08','hostId':READER,'location':'Invented reading room','beverageMemberIds':[]}
   return command('club_close_ballot',[literal(ADMIN),literal(uuid.uuid4()),data(payload)])
  def held(sql):
   child=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,text=True,bufsize=1)
   child.stdin.write('BEGIN;\n'+sql+'\n\\echo LOCK_HELD\n');child.stdin.flush()
   while True:
    line=child.stdout.readline()
    if line.strip()=='LOCK_HELD':break
    if not line:raise AssertionError(child.stderr.read())
   return child
  def commit(child):
   child.stdin.write('COMMIT;\n\\q\n');child.stdin.flush();out,err=child.communicate(timeout=15);assert child.returncode==0,err
  try:
   # Exercise the actual Node adapter as well as raw PostgreSQL command races.
   # A jsonb parameter must stay an object, not a doubly encoded JSON string.
   adapter_env={**env,'PGHOST':str(socket),'PGPORT':'5432','PGUSER':'test_admin','BOOKCLUB_TEST_DATABASE_URL':'postgresql:///postgres?sslmode=disable'}
   probe="""const assert=require('node:assert/strict');const {postgresDatabase}=require('./src/lib/store/database.ts');(async()=>{const db=await postgresDatabase(process.env.BOOKCLUB_TEST_DATABASE_URL);try{const input={nested:{label:'Invented'},list:[1,2],empty:null};const [row]=await db.query('SELECT $1::jsonb AS object,$2::json AS scalar',[JSON.stringify(input),JSON.stringify('Invented scalar')]);assert.deepEqual(row.object,input);assert.equal(row.scalar,'Invented scalar')}finally{await db.close()}})().catch(e=>{console.error('PostgreSQL adapter JSON round-trip failed: '+e.message);process.exitCode=1})"""
   adapter_result=subprocess.run(['node','--import','tsx','-e',probe],cwd=ROOT,env=adapter_env,text=True,capture_output=True)
   assert adapter_result.returncode==0,adapter_result.stderr
   query('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;')
   for p in sorted((ROOT/'db/migrations').glob('*.sql')):query(p.read_text())
   query(f"UPDATE club_metadata SET mode='demo',demo_date='2035-04-01';INSERT INTO members(id,full_name,display_name,role) VALUES({literal(ADMIN)},'Fictional Organizer','Organizer','admin'),({literal(READER)},'Fictional Reader','Reader','member');")
   for role in ['anon','authenticated']:
    assert query(f"SELECT count(*) FROM pg_tables WHERE schemaname='public' AND has_table_privilege('{role}',quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT,INSERT,UPDATE,DELETE');")=='0','Provider default browser grants survived setup'
    assert 'permission denied' in query(f'SET ROLE {role};SELECT * FROM members;',True)
    assert 'permission denied' in query(f'SET ROLE {role};SELECT club_lock();',True)
   b=draft(7);voter=held(vote(b));pending_close=close(b)
   with ThreadPoolExecutor(max_workers=1) as pool:
    future=pool.submit(query,pending_close,True);time.sleep(.2);assert not future.done(),'Close did not wait for the vote transaction';commit(voter);assert 'stale_close_preview' in future.result()
   query(close(b,1));assert query(f"SELECT count(*) FROM historical_votes WHERE ballot_id={literal(b['id'])};")=='2'
   b=draft(8);closer=held(close(b))
   with ThreadPoolExecutor(max_workers=1) as pool:
    future=pool.submit(query,vote(b),True);time.sleep(.2);assert not future.done(),'Vote did not wait for finalization';commit(closer);assert 'ballot_closed' in future.result()
   assert query(f"SELECT count(*) FROM survey_responses WHERE ballot_id={literal(b['id'])};")=='0'
   print(version+': both real-connection vote/close race orders and browser-role denials pass.')
  finally:subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-m','immediate','-w','stop'],env=env,check=True,capture_output=True)
if __name__=='__main__':main()
