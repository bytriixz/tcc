# routes.py
from flask import Blueprint, render_template, request
from models import Feedback
from extensions import db

main_blueprint = Blueprint('main', __name__)

@main_blueprint.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        name = request.form['name']
        message = request.form['message']
        feedback = Feedback(name=name, message=message)
        db.session.add(feedback)
        db.session.commit()
    feedbacks = Feedback.query.all()
    return render_template('index.html', feedbacks=feedbacks)
