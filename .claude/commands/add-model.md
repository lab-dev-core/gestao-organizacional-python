# Adicionar Novo Modelo Pydantic

Crie um novo modelo de dados Pydantic para o backend seguindo os padrões do projeto.

## Contexto do Projeto

- **Modelos**: `projeto-backend/app/models/`
- **Enums compartilhados**: `projeto-backend/app/models/enums.py`
- **Framework**: Pydantic v2 com MongoDB (ObjectId via PyObjectId ou string)
- **Campos padrão**: `id`, `tenant_id`, `created_at`, `updated_at`
- **Soft delete**: Inclua campo `deleted_at: Optional[datetime]` se aplicável

## Padrões a Seguir

1. Leia `models/user.py` e `models/document.py` para entender o padrão de herança
2. Use `Optional` para campos não obrigatórios
3. Use enums de `models/enums.py` quando aplicável (UserRole, UserStatus, etc.)
4. Crie submodelos separados: `ModelCreate`, `ModelUpdate`, `ModelInDB`, `ModelResponse`
5. Use `Field(default_factory=datetime.utcnow)` para timestamps automáticos
6. Valide campos com validators do Pydantic v2 quando necessário
7. Adicione `model_config = ConfigDict(populate_by_name=True)` para compatibilidade com MongoDB

## Tarefa

$ARGUMENTS

Crie o modelo com os submodelos necessários e registre os índices MongoDB adequados em `database.py`.
