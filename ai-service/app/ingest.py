"""
Ingestion Module for SupportSense.

Ingestion: Loading documents from disk, cutting them into bite-sized chunks,
generating vector embeddings for each chunk, and storing them in the vector database.
"""

from pathlib import Path
from typing import List, Dict, Any
from app.config import DOCS_DIR
from app.retriever import get_embedding_model, get_chroma_client, get_collection


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into chunks of approximately chunk_size characters with overlap.

    Chunking: Breaking large documents into smaller pieces so the search engine can
    find the exact relevant section rather than reading an entire document.
    """
    cleaned_text = text.strip()
    if not cleaned_text:
        return []

    if len(cleaned_text) <= chunk_size:
        return [cleaned_text]

    chunks = []
    start = 0
    stride = chunk_size - overlap

    while start < len(cleaned_text):
        end = min(start + chunk_size, len(cleaned_text))
        piece = cleaned_text[start:end].strip()
        if piece:
            chunks.append(piece)

        if end >= len(cleaned_text):
            break

        start += stride

    return chunks


def ingest_documents(docs_dir: Path = DOCS_DIR) -> Dict[str, Any]:
    """
    Read all .md and .txt files from docs_dir, chunk them, compute embeddings,
    and persist them into ChromaDB.

    Returns:
      { "chunks_stored": int, "files_processed": list[str] }
    """
    if not docs_dir.exists():
        raise FileNotFoundError(f"Documents directory does not exist: {docs_dir}")

    # Gather all markdown and text files
    doc_files = sorted(
        list(docs_dir.glob("*.md")) + list(docs_dir.glob("*.txt"))
    )

    if not doc_files:
        return {"chunks_stored": 0, "files_processed": []}

    all_ids: List[str] = []
    all_chunks: List[str] = []
    all_metadatas: List[Dict[str, Any]] = []
    processed_files: List[str] = []

    for file_path in doc_files:
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = file_path.read_text(encoding="latin-1")

        chunks = chunk_text(content, chunk_size=500, overlap=50)
        processed_files.append(file_path.name)

        for idx, chunk in enumerate(chunks):
            chunk_id = f"{file_path.name}_chunk_{idx}"
            all_ids.append(chunk_id)
            all_chunks.append(chunk)
            all_metadatas.append({
                "source": file_path.name,
                "chunk_number": idx,
                "file_path": str(file_path),
            })

    if not all_chunks:
        return {"chunks_stored": 0, "files_processed": processed_files}

    # Reset collection to ensure fresh state upon reingestion
    client = get_chroma_client()
    try:
        client.delete_collection("support_sense_kb")
    except Exception:
        pass

    collection = get_collection("support_sense_kb")

    # Generate embeddings with all-MiniLM-L6-v2
    model = get_embedding_model()
    embeddings = model.encode(all_chunks).tolist()

    # Store in ChromaDB
    collection.add(
        ids=all_ids,
        documents=all_chunks,
        embeddings=embeddings,
        metadatas=all_metadatas,
    )

    return {
        "chunks_stored": len(all_chunks),
        "files_processed": processed_files,
    }
