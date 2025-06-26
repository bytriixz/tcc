import random
from datetime import datetime

MOTIVATIONAL_MESSAGES = [
    "Continue assim! Você está indo muito bem!",
    "Ótimo progresso, continue se esforçando!",
    "Seu trabalho está fazendo a diferença!",
    "Cada passo conta, continue firme!",
    "Você é capaz de grandes conquistas!"
]

def get_motivational_message():
    return random.choice(MOTIVATIONAL_MESSAGES)

def get_positive_feedback(count):
    if count == 0:
        return ''
    elif count < 3:
        return "Bom começo! Continue enviando feedbacks para melhorar cada vez mais!"
    elif count < 7:
        return "Excelente progresso! Seu empenho está visível!"
    else:
        return "Você está arrasando! Continue mantendo esse ritmo!"
