class ServiceError(Exception):
    """Classe base para erros esperados da camada de service.

    Criar uma base comum facilita o tratamento global de erros depois,
    quando adicionarmos handlers no FastAPI.
    """

    status_code = 400
    detail = "Service error"

    def __init__(self, detail: str | None = None) -> None:
        if detail is not None:
            self.detail = detail

        super().__init__(self.detail)


class NotFoundError(ServiceError):
    """Erro para recursos não encontrados."""

    status_code = 404
    detail = "Resource not found"


class ConflictError(ServiceError):
    """Erro para conflitos de estado, como e-mail duplicado."""

    status_code = 409
    detail = "Resource already exists"


class ForbiddenError(ServiceError):
    """Erro para ações não permitidas para o usuário atual."""

    status_code = 403
    detail = "Forbidden"


class BadRequestError(ServiceError):
    """Erro para requisições inválidas do ponto de vista de negócio."""

    status_code = 400
    detail = "Bad request"
