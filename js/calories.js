const Calories = {
  // Walking MET-based: calories = weight(kg) * distance(km) * 0.75
  calculate(weightKg, distanceKm) {
    if (!weightKg || !distanceKm) return 0;
    return Math.round(weightKg * distanceKm * 0.75);
  },

  // Real-time calculation during walk
  calculateFromWeight(weightKg, distanceKm) {
    return this.calculate(weightKg, distanceKm);
  }
};
