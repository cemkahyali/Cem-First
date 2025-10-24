const form = document.getElementById("search-form");
const resultsContainer = document.getElementById("results");
const statusElement = document.getElementById("status");

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.classList.remove("error");
  if (type === "error") {
    statusElement.classList.add("error");
  }
}

function formatPrice(value) {
  if (value == null) {
    return "-";
  }
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function renderResults(data) {
  resultsContainer.innerHTML = "";
  if (!Array.isArray(data.results) || data.results.length === 0) {
    resultsContainer.innerHTML = "<p>Sonuç bulunamadı.</p>";
    return;
  }

  const cheapestRetailer = data.cheapest ? data.cheapest.retailer : null;

  data.results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "result-card";
    if (result.retailer === cheapestRetailer && result.price != null) {
      card.classList.add("best");
    }

    const retailer = document.createElement("div");
    retailer.className = "retailer";
    retailer.textContent = result.retailer;

    const name = document.createElement("h3");
    name.textContent = result.product_name || "Ürün bilgisi alınamadı";

    const priceBlock = document.createElement("div");
    priceBlock.className = "price-block";

    const renderPricePair = (labelText, valueText, extraClass) => {
      const wrapper = document.createElement("div");
      wrapper.className = extraClass;

      const label = document.createElement("span");
      label.className = "price-label";
      label.textContent = labelText;

      const value = document.createElement("span");
      value.className = "price-value";
      value.textContent = valueText;

      wrapper.append(label, value);
      return wrapper;
    };

    const currentPriceText =
      result.raw_price_text || formatPrice(result.price);
    const originalText =
      result.original_price_text || formatPrice(result.original_price);
    const hasOriginal =
      originalText &&
      (typeof result.original_price === "number"
        ? typeof result.price !== "number" ||
          Math.abs(result.original_price - result.price) > 0.01
        : true);

    const currentLabelText = hasOriginal ? "İndirimli fiyat" : "Fiyat";

    priceBlock.appendChild(
      renderPricePair(currentLabelText, currentPriceText, "price-current")
    );

    if (hasOriginal) {
      priceBlock.appendChild(
        renderPricePair("Normal fiyat", originalText, "price-original")
      );
    }

    card.append(retailer, name, priceBlock);

    if (result.product_url) {
      const link = document.createElement("a");
      link.href = result.product_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Ürüne git";
      card.appendChild(link);
    }

    if (result.error) {
      const error = document.createElement("p");
      error.textContent = result.error;
      error.className = "form-helper";
      card.appendChild(error);
    }

    resultsContainer.appendChild(card);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const query = formData.get("query");
  if (!query) {
    setStatus("Lütfen bir ürün adı girin.", "error");
    return;
  }

  setStatus("Fiyatlar getiriliyor...");
  resultsContainer.innerHTML = "";

  fetch(`/api/compare?query=${encodeURIComponent(query)}`)
    .then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(payload.error || "Sunucu hatası");
      }
      return response.json();
    })
    .then((data) => {
      if (data.results && data.results.some((item) => item.price != null)) {
        setStatus(`${data.query} için sonuçlar hazır.`);
      } else if (data.results && data.results.length > 0) {
        setStatus("Ürünler bulundu ancak fiyat bilgisi alınamadı.", "error");
      } else {
        setStatus("Sonuç bulunamadı.", "error");
      }
      renderResults(data);
    })
    .catch((error) => {
      console.error(error);
      setStatus(error.message || "Bir hata oluştu", "error");
      resultsContainer.innerHTML = "";
    });
});
