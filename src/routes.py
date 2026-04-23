"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import os
import ast
import numpy as np
from flask import send_from_directory, request, jsonify
from models import db, Song
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

# ── AI toggle ────────────────────────────────────────────────────────────────
# USE_LLM = False
USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

vectorizer = None
song_vectors = None
songs_data = None

svd_model = None
lyrics_latent = None

# Number of latent dimensions (tune between 50-200)
N_COMPONENTS = 50 

# Blend weight: 0 = pure cosine, 1 = pure SVD
ALPHA = 0.5 

latent_dim_names = [
    "Melancholy",
    "Reflection",
    "Heartache",
    "Swagger",
    "Dreamscape",
    "Hope",
    "Nostalgia",
    "Noise",
    "Confidence",
    "Longing",
    "Turmoil",
    "Performance",
    "Confession",
    "Rock Anthem",
    "Conflict",
    "Escape",
    "Loneliness",
    "Dark Romance",
    "Nightlife",
    "Wonder",
    "Existence",
    "Fragility",
    "Resolve",
    "Storytelling",
    "Finality",
    "Tenderness",
    "Regret",
    "Resilience",
    "Transformation",
    "Starlight",
    "Devotion",
    "Soulsearching",
    "Yearning",
    "Intensity",
    "Forever",
    "Perseverance",
    "Belonging",
    "Struggle",
    "Motion",
    "Chaos",
    "Recovery",
    "Change",
    "Tension",
    "Upheaval",
    "Togetherness",
    "Reminiscence",
    "Healing",
    "Identity",
    "Lessons",
    "Attitude"
]      

def build_search_index():
    global vectorizer, song_vectors, songs_data, svd_model, lyrics_latent

    songs_data = db.session.query(Song).all()

    all_text = []
    for song in songs_data:
        if isinstance(song.lyrics, list):
            text = " ".join(song.lyrics)
        else:
            text = song.lyrics or ""
        all_text.append(text)

    # Cosine similarity TF-IDF
    custom_stopwords = list(TfidfVectorizer(stop_words='english').get_stop_words()) + [
        'da', 'na', 'la', 'oh', 'ah', 'ooh', 'uh', 'yeah', 'hey', 'gonna',
        'wanna', 'gotta', 'ain', 'don', 'cause', 'em', 'til', 'ya', 'yo',
        'duh', 'ha', 'hm', 'mm', 'wa', 'ba', 'sha', 'ra', 'ta', 'pa', 'eh', 'oooh'
    ]
    vectorizer = TfidfVectorizer(stop_words=custom_stopwords)
    song_vectors = vectorizer.fit_transform(all_text)
    song_vectors = vectorizer.fit_transform(all_text)

    # SVD
    n_components = min(N_COMPONENTS, len(all_text) - 1) 
    svd_model = TruncatedSVD(n_components=n_components, random_state=42)
    lyrics_latent = svd_model.fit_transform(song_vectors)
    lyrics_latent = normalize(lyrics_latent)

    print(f"Search index built: {len(all_text)} songs, {n_components} SVD dimensions")
    # for dim in range(50):
    #         top_word_indices = np.argsort(svd_model.components_[dim])[::1][:50]
    #         top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
    #         print(f"dim: {dim}")
    #         print(f"{top_words}")
    #         # for word in top_words:
    #         #     print(f"{word}")


def svd_search(user_input):
    """Project query into SVD latent space and compute cosine similarity."""
    global vectorizer, svd_model, lyrics_latent

    query_tfidf = vectorizer.transform([user_input])       # sparse TF-IDF vector
    query_latent = svd_model.transform(query_tfidf)        # project into latent space
    query_latent = normalize(query_latent)                 # L2 normalize

    scores = lyrics_latent @ query_latent.T                # cosine sim in latent space
    return scores.flatten()

def explain_svd(user_input, n_topics=3):
    """Return top latent mood dimensions the query activates, with representative words."""
    global vectorizer, svd_model

    query_tfidf = vectorizer.transform([user_input])
    query_latent = svd_model.transform(query_tfidf).flatten()

    top_dims = np.argsort(np.abs(query_latent))[::-1][:n_topics]
    explanations = []
    for dim in top_dims:
        top_word_indices = np.argsort(svd_model.components_[dim])[::-1][:5]
        top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
        explanations.append({
            "dimension": int(dim),
            "strength": round(float(query_latent[dim]), 4),
            "mood_words": top_words   # e.g. ["love", "heart", "feel", "miss", "cry"]
        })
    return explanations

def get_all_genres():
    return sorted(list(set(song.genres for song in songs_data if song.genres)))

def song_has_genre(song, genre):
    if not song.genres:
        return False
    try:
        genres = ast.literal_eval(song.genres)
    except:
        return False

    return genre.lower() in [g.lower() for g in genres]

def recommend_by_lyrics(user_input, top_n=5, instrument="guitar", difficulty="all", genre="all"):
    global vectorizer, song_vectors, songs_data

    user_vector = vectorizer.transform([user_input])
    cosine_scores = cosine_similarity(user_vector, song_vectors).flatten()
    svd_scores = svd_search(user_input)
    combined_scores = ALPHA * svd_scores + (1 - ALPHA) * cosine_scores

    candidates = []

    for i, song in enumerate(songs_data):
        if genre != "all" and not song_has_genre(song, genre):
            continue
        candidates.append(i)

    ranked = sorted(
        candidates,
        key=lambda i: combined_scores[i],
        reverse=True
    )

    results = []
    for idx in ranked:
        song = songs_data[idx]

        if difficulty == "easy":
            low, high = 1, 4
        elif difficulty == "medium":
            low, high = 4.01, 7
        elif difficulty == "hard":
            low, high = 7.01, 10
        else:
            low, high = None, None

        if low is not None:
            score = song.guitar_difficulty if instrument == "guitar" else song.piano_difficulty
            if not (low <= score <= high):
                continue

        results.append([
            song,
            float(combined_scores[idx]) * 100,
            float(cosine_scores[idx]) * 100,
            float(svd_scores[idx]) * 100
        ])

        if len(results) == top_n:
            break

    return results

def exact_title_search(query, top_n=5, instrument="guitar", difficulty="all", genre="all"):
    if not query or not query.strip():
        return {"results": [], "message": "no result found"}

    query_clean = query.strip().lower()

    exact_song = None
    for song in songs_data:
        if song.title and song.title.strip().lower() == query_clean:
            exact_song = song
            break

    if not exact_song:
        return {"results": [], "message": "no result found"}

    if isinstance(exact_song.lyrics, list):
        seed_text = " ".join(exact_song.lyrics)
    else:
        seed_text = exact_song.lyrics or exact_song.title

    similar_results = recommend_by_lyrics(
        seed_text,
        top_n=top_n + 1,
        instrument=instrument,
        difficulty=difficulty,
        genre=genre
    )

    filtered_similars = [
        s for s in similar_results
        if s[0].title.lower() != query_clean
    ][:top_n]

    try:
        genres = ast.literal_eval(exact_song.genres) if exact_song.genres else []
    except:
        genres = []

    diff = (
        exact_song.guitar_difficulty
        if instrument == "guitar"
        else exact_song.piano_difficulty
    )

    results = [{
        'title': exact_song.title,
        'artist': exact_song.artist,
        'similarity': 100.0,
        'chords': exact_song.chords,
        'difficulty': diff,
        'genres': genres,
        'match_type': 'exact'
    }]

    for song, combined, cosine, svd in filtered_similars:
        try:
            genres = ast.literal_eval(song.genres) if song.genres else []
        except:
            genres = []

        diff = (
            song.guitar_difficulty
            if instrument == "guitar"
            else song.piano_difficulty
        )

        results.append({
            'title': song.title,
            'artist': song.artist,
            'similarity': round(combined, 2),
            'cosine_score': round(cosine, 2),
            'svd_score': round(svd, 2),
            'chords': song.chords,
            'difficulty': diff,
            'genres': genres,
            'match_type': 'similar'
        })

    return {"results": results}

def json_search(query, top_n=5, instrument="guitar", difficulty="all", exact_match=False, genre="all"):
    if exact_match:
        return exact_title_search(query, top_n, instrument, difficulty, genre)
        
    if not query or not query.strip():
        query = "Love"

    results = recommend_by_lyrics(query, top_n, instrument, difficulty, genre)
    
    # Get query's latent vector once
    query_tfidf = vectorizer.transform([query])
    query_latent = svd_model.transform(query_tfidf).flatten()

    matches = []
    for song in results:
        try:
            genres = ast.literal_eval(song[0].genres) if song[0].genres else []
        except:
           genres = []

        song_idx = songs_data.index(song[0])
        song_latent = lyrics_latent[song_idx]  # this specific song's latent vector

        # Element-wise product: high where BOTH query and song activate the same dimension
        combined_activation = query_latent * song_latent
        
        pos_top_dims = np.argsort(combined_activation)[::-1][:3]
        neg_top_dims = np.argsort(combined_activation)[::1][:3]
        per_song_explanation = []
        for dim in pos_top_dims:
            top_word_indices = np.argsort(svd_model.components_[dim])[::-1][:5]
            top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
            per_song_explanation.append({
                "dimension": latent_dim_names[int(dim)],
                "strength": round(float(combined_activation[dim]), 4),
                "mood_words": top_words
            })
        for dim in neg_top_dims:
            top_word_indices = np.argsort(svd_model.components_[dim])[::-1][:5]
            top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
            per_song_explanation.append({
                "dimension": latent_dim_names[int(dim)],
                "strength": round(float(combined_activation[dim]), 4),
                "mood_words": top_words
            })
            

        if instrument == "guitar":
            diff = song[0].guitar_difficulty
        else:
            diff = song[0].piano_difficulty
        matches.append({
            'title': song[0].title,
            'artist': song[0].artist,
            'similarity': round(song[1], 2),  
            'cosine_score': round(song[2], 2), 
            'svd_score': round(song[3], 2),  
            'chords': song[0].chords,
            'difficulty': diff,
            'genres': genres,
            'svd_explanation': per_song_explanation  # unique per song
        })

    return {'results': matches}

def register_routes(app):
    with app.app_context():
        build_search_index()
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    @app.route("/api/config")
    def config():
        return jsonify({"use_llm": USE_LLM})

    @app.route("/api/genres")
    def genres():
        songs = db.session.query(Song).all()
        genre_set = set()
        for song in songs:
            if not song.genres:
                continue
            try:
                parsed = ast.literal_eval(song.genres)
            except:
                continue
            for g in parsed:
                genre_set.add(g.strip().lower())

        return jsonify(sorted(list(genre_set)))

    @app.route("/api/songs")
    def song_search():
        text = request.args.get("title", "")
        
        top_n = request.args.get("topn", 5 ,type=int)
        exact_match = request.args.get("exact", "false").lower() == "true"
        print(f"Title: {text}")
        print(f"Num results: {top_n}")
        instrument = request.args.get("instrument", "")
        difficulty = request.args.get("difficulty", "")
        genre = request.args.get("genre", "all")
        
        print(f"Instrument: {instrument}")
        print(f"Difficulty: {difficulty}")
        return jsonify(json_search(text, top_n, instrument, difficulty, exact_match, genre))

    if USE_LLM:
        from llm_routes import register_chat_route
        from rag_routes import register_rag_route 
        register_chat_route(app, json_search)
        register_rag_route(app, json_search) 
