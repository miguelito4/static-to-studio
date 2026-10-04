# Build a static blyg shaped like caseyjr.org/blyg (8 fragments, v1) for testing.
import json, hashlib, os, sys
root = sys.argv[1]; origin = sys.argv[2]
items = [
 ("18q6e6ge6yrq267pxpc8jcymwq","2026-09-30T14:02:11Z",'Returning to a kitchen-table musing from last December on "open source and the AI bubble"\n\nStill holds up, imo, and still believe in the arguments\n\n<https://bits.caseyjr.org/will-open-source-pop-the-ai-bubble/>',
  '<p>Returning to a kitchen-table musing from last December on &quot;open source and the AI bubble&quot;</p>\n<p>Still holds up, imo, and still believe in the arguments</p>\n<p><a href="https://bits.caseyjr.org/will-open-source-pop-the-ai-bubble/">https://bits.caseyjr.org/will-open-source-pop-the-ai-bubble/</a></p>\n'),
 ("3pjndkezgd3s63dzvg9m6j72cc","2026-09-30T01:15:40Z","My youngest started participating in an after-school chess club today.\n\nI can't stop saying \"[chest](https://youtu.be/3ayCXNrnV00)\" like Bluey",
  '<p>My youngest started participating in an after-school chess club today.</p>\n<p>I can\'t stop saying &quot;<a href="https://youtu.be/3ayCXNrnV00">chest</a>&quot; like Bluey</p>\n'),
 ("5xyejdk26w8f89jw2mdhp6kxjg","2026-09-29T19:44:02Z","You ever wonder what Ada Lovelace, Thomas Edison, Benjamin Franklin, or Leonardo da Vinci would do with LLMs?",
  "<p>You ever wonder what Ada Lovelace, Thomas Edison, Benjamin Franklin, or Leonardo da Vinci would do with LLMs?</p>\n"),
 ("7jdb7t8p26xpdr8t6afsj1142s","2026-09-29T01:30:00Z","It occurred to me at dinner this evening that when my kids turn my current age, I will be geriatric af (if I'm still among the living).\n\nA melancholy realization as the sand in the hourglass continues to fall.",
  "<p>It occurred to me at dinner this evening that when my kids turn my current age, I will be geriatric af (if I'm still among the living).</p>\n<p>A melancholy realization as the sand in the hourglass continues to fall.</p>\n"),
 ("18wtf8thq38723qsykxj9fz3gf","2026-09-28T03:10:55Z","Publishing this from my phone: type, tap, live.\n\nThe tool is a one-tap Drafts action — سلام — that commits to my site's repo.",
  "<p>Publishing this from my phone: type, tap, live.</p>\n<p>The tool is a one-tap Drafts action — سلام — that commits to my site's repo.</p>\n"),
 ("7jdc4bdjx7zq984v2mrwcjmvtf","2026-09-28T00:05:31Z","Have despised the NFL for a long time now, and yet I continue watching the highlights on Sunday evenings. Old habits die hard.",
  "<p>Have despised the NFL for a long time now, and yet I continue watching the highlights on Sunday evenings. Old habits die hard.</p>\n"),
 ("6p7jfwqhnnr0qcagbzjbk7q0mc","2026-09-27T22:31:23Z","Really enjoyed reading Abraham Flexner's essay this evening.\n\n> The real enemy of the human race is not the fearless and irresponsible thinker, be he right or wrong.",
  "<p>Really enjoyed reading Abraham Flexner's essay this evening.</p>\n<blockquote>\n<p>The real enemy of the human race is not the fearless and irresponsible thinker, be he right or wrong.</p>\n</blockquote>\n"),
 ("482byjta98gsbwf4rpmfavpwqw","2026-09-26T18:05:10Z","Some morsels from Philip Ball's *How Life Works*:\n\n> I suspect it is in fact precisely by virtue of being a thing that has autonomous goals... (36-7)",
  "<p>Some morsels from Philip Ball's <em>How Life Works</em>:</p>\n<blockquote>\n<p>I suspect it is in fact precisely by virtue of being a thing that has autonomous goals... (36-7)</p>\n</blockquote>\n"),
]
os.makedirs(f"{root}/items", exist_ok=True)
index = []
for id_, ts, md, html in items:
    doc = {"blyg":"0.3","id":id_,"kind":"fragment","origin":origin,"page":f"f/{id_}/",
           "author":{"name":"Mike Casey","url":"https://caseyjr.org/"},"created":ts,"updated":ts,"version":1,
           "content_md":md,"content_html":html,"content_hash":"sha256:"+hashlib.sha256(md.encode()).hexdigest(),
           "media":[],"changelog":[{"version":1,"at":ts,"note":None}]}
    json.dump(doc, open(f"{root}/items/{id_}.json","w"), ensure_ascii=False)
    index.append({"id":id_,"kind":"fragment","created":ts,"updated":ts,"version":1})
json.dump({"updated":items[0][1],"items":index}, open(f"{root}/items/index.json","w"))
json.dump({"blyg":"0.3","level":1,"generator":"caseyjr-blyg/0.1.0","site":origin,"title":"Mike Casey",
  "author":{"name":"Mike Casey","bio":"Building with applied AI. Nerding out on decentralized protocols, capital, history, and planetary challenges.",
  "links":[{"label":"Home","url":"https://caseyjr.org/"},{"label":"Writing","url":"https://caseyjr.org/writing/"}]},
  "feed":"feed.xml","items":"items/index.json","updated":items[0][1]}, open(f"{root}/blyg.json","w"))
print(f"{len(items)} items -> {root}")
