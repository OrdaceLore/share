"""Local-only integration test. Never point this at a hosted production Site."""
import urllib.request,urllib.error,json,uuid,concurrent.futures
BASE='http://127.0.0.1:5173/api/music'
u='test-'+str(uuid.uuid4())
def call(body=None,user=u):
 headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test','Content-Type':'application/json','Cookie':'__sites_local_auth=1'}
 req=urllib.request.Request(BASE,data=json.dumps(body).encode() if body else None,headers=headers)
 try:
  with urllib.request.urlopen(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
assert call()[1]['balance']==0
assert call({'action':'submit','title':''})[0]==400
assert call({'action':'submit','title':'Test music','url':'javascript:alert(1)'})[0]==400
status,d=call({'action':'submit','title':'Test music','tags':['独立','治愈']});assert status==200,(status,d)
assert d['balance']==1
assert call({'action':'submit','title':'Test music'})[0]==409
mine=d['mine'][0]['id'];assert call({'action':'rate','song':mine,'value':3})[0]==409
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda _:call({'action':'exchange'}),range(2)))
assert sum(s==200 for s,d in results)==1,results
_,d=call();assert d['balance']==0 and len(d['received'])==3
song=d['received'][0]['id'];assert call({'action':'rate','song':song,'value':3})[0]==200
assert call({'action':'rate','song':song,'value':3})[0]==409
assert call({'action':'rate','song':'seed-does-not-exist','value':3})[0]==409
print('PASS: validation, duplicate recommendation, self-rating, concurrent exchange, balance, receipts, single-use ratings')
