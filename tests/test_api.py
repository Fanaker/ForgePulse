from pathlib import Path
from fastapi.testclient import TestClient
from forgepulse.api import create_app


def test_endpoints_and_predictive_readings(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        health=client.get('/api/health')
        assert health.status_code==200 and health.json()['mode']=='synthetic-demo'
        overview=client.get('/api/overview').json()
        assert overview['summary']['assets_total']==10
        assert overview['summary']['readings']==960
        assert len(overview['history']) >= 23
        machine=client.get('/api/assets/C-201').json()
        assert machine['asset']['name']=='Compresor principal'
        assert len(machine['readings']) == 96
        assert 0 <= machine['asset']['risk'] <= 1


def test_simulation_and_alert_acknowledgement(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        before=client.get('/api/overview').json()['summary']['readings']
        result=client.post('/api/simulate',json={'asset_id':'M-301','scenario':'bearing'})
        assert result.status_code==200
        assert result.json()['reading']['vibration'] > 7.5
        assert client.get('/api/overview').json()['summary']['readings']==before+1
        alerts=client.get('/api/alerts').json()
        assert alerts
        target=alerts[0]['id']
        assert client.post(f'/api/alerts/{target}/acknowledge').json()['ok'] is True
        assert any(a['id']==target and a['acknowledged']==1 for a in client.get('/api/alerts').json())


def test_validation_reset_and_csv_export(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        assert client.post('/api/simulate',json={'asset_id':'XYZ','scenario':'normal'}).status_code==404
        assert client.post('/api/simulate',json={'asset_id':'M-301','scenario':'unknown'}).status_code==422
        csv=client.get('/api/export.csv')
        assert csv.status_code==200
        assert len(csv.text.splitlines())==961
        pipeline=client.get('/api/pipeline').json()
        assert pipeline['quality']['null_values']==0
        assert len(pipeline['schema'])>=6
        assert client.post('/api/demo/reset').status_code==200
        assert client.get('/api/overview').json()['summary']['readings']==960


def test_ml_evaluation_is_exposed(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        metadata=client.get('/api/model').json()
        assert metadata['algorithm']=='RandomForestClassifier'
        assert metadata['train_samples']>1000
        assert 0 <= metadata['f1'] <= 1
        assert sum(sum(row) for row in metadata['confusion_matrix']) == metadata['test_samples']
