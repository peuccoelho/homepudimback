from flask import Flask, jsonify
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from collections import defaultdict
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["https://papudim.netlify.app/admin.html"])

# 🔃 Carrega variáveis do .env
load_dotenv()

# 🔐 Configurações do Firebase
firebase_config = {
    "type": "service_account",
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "token_uri": "https://oauth2.googleapis.com/token"
}

if not firebase_admin._apps:
    cred = credentials.Certificate(firebase_config)
    firebase_admin.initialize_app(cred)
db = firestore.client()

@app.route("/api/insights")
def insights():
    pedidos_ref = db.collection("pedidos")
    docs = pedidos_ref.stream()

    sabores = defaultdict(int)
    faturamento_total = 0
    faturamento_por_sabor = defaultdict(float)
    pedidos_por_data = defaultdict(float)

    for doc in docs:
        pedido = doc.to_dict()
        itens = pedido.get("itens", [])
        total = float(pedido.get("total", 0))
        status = pedido.get("status", "")
        data_timestamp = pedido.get("id", "").split("-")[-1]

        if status == "pago":
            faturamento_total += total

            if data_timestamp.isdigit():
                data_str = pd.to_datetime(int(data_timestamp), unit="ms").strftime("%Y-%m-%d")
                pedidos_por_data[data_str] += total

            for item in itens:
                nome = item["nome"]
                quantidade = int(item["quantidade"])
                preco_unit = float(item["preco"])
                sabores[nome] += quantidade
                faturamento_por_sabor[nome] += preco_unit * quantidade

    # Top 5 sabores
    top_sabores = sorted(sabores.items(), key=lambda x: x[1], reverse=True)[:5]
    # Timeline de faturamento
    timeline = sorted(pedidos_por_data.items())

    return jsonify({
        "faturamento_total": faturamento_total,
        "top_sabores": [{"sabor": s, "quantidade": q} for s, q in top_sabores],
        "timeline": [{"data": d, "faturamento": v} for d, v in timeline]
    })

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
