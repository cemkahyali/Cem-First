"""Flask application serving the price comparison interface."""

from __future__ import annotations

from typing import Optional

from flask import Flask, jsonify, render_template, request

from price_fetchers import PriceResult, compare_prices

app = Flask(__name__)


@app.route("/")
def index():
    """Render the main landing page."""

    return render_template("index.html")


@app.route("/api/compare")
def api_compare():
    """Return price comparison results as JSON."""

    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Ürün adı gerekli"}), 400

    results = compare_prices(query)
    cheapest: Optional[PriceResult] = next((result for result in results if result.is_successful), None)

    return jsonify(
        {
            "query": query,
            "results": [result.to_dict() for result in results],
            "cheapest": cheapest.to_dict() if cheapest else None,
        }
    )


@app.errorhandler(Exception)
def handle_exception(error: Exception):  # pragma: no cover - user feedback path
    """Render friendly JSON for unexpected errors."""

    app.logger.exception("Beklenmeyen hata", exc_info=error)
    return jsonify({"error": "Beklenmeyen bir hata oluştu", "detail": str(error)}), 500


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    app.run(debug=True, port=8080)
