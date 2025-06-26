# app.py
from flask import Flask
from extensions import db
from routes import main_blueprint

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///feedback.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    app.register_blueprint(main_blueprint)
    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()  # Cria o banco de dados se ainda não existir
    app.run(debug=True)
