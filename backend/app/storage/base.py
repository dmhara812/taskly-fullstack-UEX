from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    """Contrato mínimo para armazenar bytes fora do banco de dados.

    A camada de serviço conhece apenas esta interface. Assim, a implementação
    local usada no case pode ser trocada por S3 ou outro provider sem alterar
    regras de ownership, validação de arquivos ou metadados persistidos.
    """

    @abstractmethod
    def save(self, key: str, content: bytes) -> None:
        """Persiste o conteúdo usando uma chave interna não fornecida pelo usuário."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Abre o arquivo para leitura binária pelo endpoint autenticado."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove o arquivo; a operação deve ser idempotente quando ele não existir."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Informa se a chave possui conteúdo persistido."""
