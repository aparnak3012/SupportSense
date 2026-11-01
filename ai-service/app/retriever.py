"""
Retriever Module for SupportSense.

Vector search: Finding relevant text chunks by converting questions and documents
into numerical coordinates (embeddings) and measuring their geometric distance.
"""

from typing import List, Dict, Any
import chromadb
from sentence_transformers import SentenceTransformer
from app.config import CHROMA_PERSIST_DIR, EMBEDDING_MODEL_NAME

# Global singletons to prevent expensive reloading
_model = None
_chroma_client = None


def get_embedding_model() -> SentenceTransformer:
    """Load and cache the sentence-transformers embedding model."""
    global _model
    if _model is None:
        # all-MiniLM-L6-v2 maps sentences to a 384-dimensional dense vector space
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def get_chroma_client() -> chromadb.PersistentClient:
    """Obtain or initialize the persistent local ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    return _chroma_client


def get_collection(name: str = "support_sense_kb"):
    """Get or create the ChromaDB collection with cosine distance metric."""
    client = get_chroma_client()
    # hnsw:space cosine ensures distances correspond directly to cosine similarity
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"}
    )


def search_relevant_chunks(ticket_text: str, top_k: int = 4) -> tuple[List[Dict[str, Any]], float]:
    """
    Search ChromaDB for the top K document chunks matching the ticket text.

    Returns:
      (chunks, best_similarity_score)
      where each chunk has {id, text, source, chunk_number, distance, similarity}
    """
    if not ticket_text.strip():
        return [], 0.0

    collection = get_collection()
    count = collection.count()
    if count == 0:
        return [], 0.0

    model = get_embedding_model()
    # Generate query embedding
    query_vector = model.encode(ticket_text).tolist()

    n_results = min(top_k, count)
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    best_similarity = 0.0

    if results and results.get("ids") and len(results["ids"][0]) > 0:
        for idx in range(len(results["ids"][0])):
            chunk_id = results["ids"][0][idx]
            document = results["documents"][0][idx]
            metadata = results["metadatas"][0][idx]
            distance = results["distances"][0][idx]

            # In cosine distance: similarity = 1 - distance (clamped between 0 and 1)
            similarity = max(0.0, min(1.0, 1.0 - float(distance)))
            if similarity > best_similarity:
                best_similarity = similarity

            chunks.append({
                "id": chunk_id,
                "text": document,
                "source": metadata.get("source", "unknown"),
                "chunk_number": metadata.get("chunk_number", 0),
                "distance": round(float(distance), 4),
                "similarity": round(similarity, 4),
            })

    return chunks, round(best_similarity, 4)
