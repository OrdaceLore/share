import sqlite3, pathlib, unittest
class Ledger(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for f in sorted(pathlib.Path('drizzle').glob('*.sql')): self.db.executescript(f.read_text())
 def balance(self,u):
  return self.db.execute('SELECT (SELECT COUNT(*) FROM songs WHERE owner=?)+(SELECT COALESCE(SUM(r.value),0) FROM ratings r JOIN songs s ON s.id=r.song WHERE s.owner=?)-(SELECT COUNT(*) FROM exchanges WHERE owner=?)',(u,u,u)).fetchone()[0]
 def song(self,id='s'):
  self.db.execute("INSERT OR IGNORE INTO songs VALUES(?, 'alice', 'Song', 'Artist', '', '[]', '', 'song|artist', 1)",(id,));self.db.commit()
 def test_duplicate_recommendation_does_not_reward(self):
  self.song();self.song('s2');self.assertEqual(self.balance('alice'),1)
 def test_rewards_go_to_recommender_once(self):
  self.song();self.db.execute("INSERT INTO ratings VALUES('r','bob','s',3,1)");self.assertEqual(self.balance('alice'),4);self.assertEqual(self.balance('bob'),0)
  self.db.execute("INSERT OR IGNORE INTO ratings VALUES('r2','bob','s',3,1)");self.assertEqual(self.balance('alice'),4)
 def test_exchange_rollback_preserves_balance(self):
  self.song()
  try:
   with self.db:
    self.db.execute("INSERT INTO exchanges VALUES('e','alice',1)")
    self.db.execute("INSERT INTO receipts VALUES('r','alice','seed-0','e',1)")
    self.db.execute("INSERT INTO receipts VALUES('r2','alice','seed-0','e',1)")
  except sqlite3.IntegrityError: pass
  self.assertEqual(self.balance('alice'),1)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM receipts').fetchone()[0],0)
if __name__=='__main__':unittest.main()
