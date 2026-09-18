import urllib.request
import urllib.parse
import json

def test_europepmc():
    query = 'reaction yield optimization machine learning'
    url = f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={urllib.parse.quote(query)}&format=json&pageSize=3'
    req = urllib.request.Request(url, headers={'User-Agent': 'NucleusAI/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('resultList', {}).get('result', [])
            print('EuropePMC results:', len(results))
            for r in results:
                print('TITLE:', r.get('title'))
                print('AUTHORS:', r.get('authorString'))
                print('YEAR:', r.get('pubYear'))
                print('JOURNAL:', r.get('journalTitle'))
                print('DOI:', r.get('doi'))
                print('ABSTRACT:', (r.get('abstractText') or '')[:100] + '...')
                print('CITATIONS:', r.get('citedByCount'))
                print('IS_OA:', r.get('isOpenAccess'))
                print('---')
    except Exception as e:
        print('EuropePMC error:', e)

test_europepmc()
