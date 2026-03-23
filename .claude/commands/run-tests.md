# Executar Testes do Backend

Execute os testes do projeto backend e reporte os resultados.

## Comandos Disponíveis

```bash
# Entrar no diretório do backend
cd projeto-backend

# Executar todos os testes
pytest

# Com cobertura de código
pytest --cov=. --cov-report=term-missing

# Testes específicos
pytest tests/test_<modulo>.py -v

# Relatório HTML de cobertura
pytest --cov=. --cov-report=html
```

## Tarefa

$ARGUMENTS

Execute os testes relevantes ao contexto fornecido (ou todos se não especificado), analise os resultados e:
1. Reporte quais testes passaram/falharam
2. Para falhas, identifique a causa raiz
3. Sugira ou aplique as correções necessárias
4. Verifique se a cobertura de código está adequada para as mudanças feitas
