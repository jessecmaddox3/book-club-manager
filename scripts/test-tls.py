#!/usr/bin/env python3
"""Verify the actual PostgreSQL TLS handshake with a disposable local certificate.

localhost. resolves to loopback, but deliberately exercises the remote-host policy.
Requires PostgreSQL 17 and openssl. Uses no existing database or credentials.
"""
import os,shutil,socket,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 bins={name:shutil.which(name) for name in ['initdb','pg_ctl','openssl','node']}
 assert all(bins.values()),'Put PostgreSQL 17, openssl and Node on PATH.'
 env={key:os.environ[key] for key in ['PATH','TMPDIR','LANG','LC_ALL'] if key in os.environ}
 with tempfile.TemporaryDirectory(prefix='bookclub-tls-') as temporary:
  base=Path(temporary);cluster=base/'database';sock=base/'socket';sock.mkdir()
  with socket.socket() as listener:listener.bind(('127.0.0.1',0));port=listener.getsockname()[1]
  subprocess.run([bins['initdb'],'-D',str(cluster),'-U','test_admin','-A','trust','--no-locale','-E','UTF8'],env=env,check=True,capture_output=True)
  key=cluster/'server.key';cert=cluster/'server.crt'
  subprocess.run([bins['openssl'],'req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=bookclub-test.invalid','-addext','subjectAltName=DNS:localhost'],env=env,check=True,capture_output=True);key.chmod(0o600)
  subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-l',str(base/'postgres.log'),'-o',f"-k {sock} -p {port} -c listen_addresses='127.0.0.1' -c ssl=on",'-w','start'],env=env,check=True,capture_output=True)
  probe="""const assert=require('node:assert/strict');const {postgresDatabase}=require('./src/lib/store/database.ts');(async()=>{let db=await postgresDatabase(process.env.TEST_URL);try{await assert.rejects(db.query('SELECT 1'),/self.signed|certificate/i)}finally{await db.close()}process.env.BOOKCLUB_DATABASE_CA_CERT=process.env.TEST_CA;db=await postgresDatabase(process.env.TEST_URL);try{const [row]=await db.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');assert.equal(row.ssl,true)}finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1})"""
  try:
   result=subprocess.run([bins['node'],'--import','tsx','-e',probe],cwd=ROOT,env={**env,'TEST_URL':f'postgresql://test_admin@localhost.:{port}/postgres?sslmode=disable','TEST_CA':str(cert)},text=True,capture_output=True,timeout=90)
   assert result.returncode==0,result.stderr
   print('Real TLS handshake: untrusted certificate rejected; explicit CA succeeds over TLS despite sslmode=disable.')
  finally:subprocess.run([bins['pg_ctl'],'-D',str(cluster),'-m','immediate','-w','stop'],env=env,check=True,capture_output=True)
if __name__=='__main__':main()
