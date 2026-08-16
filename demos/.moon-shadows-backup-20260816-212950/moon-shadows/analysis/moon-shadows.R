# Moon Shadows statistical analysis
# Base R only. Run from demos/moon-shadows/analysis:
#   Rscript moon-shadows.R

earth_radius <- 6378.137

stats <- read.csv("../data/lunation-stats.csv", stringsAsFactors = FALSE)
events <- read.csv("../data/eclipse-events.csv", stringsAsFactors = FALSE)

dir.create("output", showWarnings = FALSE)

svg("output/01_closest_shadow_axis.svg", width = 9, height = 6)
hist(
  stats$min_axis_km / earth_radius,
  breaks = 24,
  col = "grey75",
  border = "white",
  main = "Closest lunar shadow-axis approach per physical pass",
  xlab = "Closest approach (Earth radii)",
  ylab = "Number of passes"
)
abline(v = 1, lwd = 2, lty = 2)
mtext("Dashed line = one Earth radius", side = 3, adj = 1, cex = 0.8)
dev.off()

radii <- seq(0, 45000, by = 250)
axis_prob <- sapply(radii, function(r) mean(stats$min_axis_km <= r))
pen_prob <- sapply(radii, function(r) mean(stats$min_penumbra_edge_km <= r))

svg("output/02_interception_probability.svg", width = 9, height = 6)
plot(
  radii / earth_radius,
  pen_prob * 100,
  type = "l",
  lwd = 2,
  ylim = c(0, 100),
  xlab = "Target radius (Earth radii)",
  ylab = "Physical passes entering target (%)",
  main = "Shadow interception probability as the target shrinks"
)
lines(radii / earth_radius, axis_prob * 100, lwd = 2, lty = 2)
abline(v = 1, lty = 3)
legend(
  "bottomright",
  legend = c("Penumbra reaches target", "Shadow axis reaches target", "Earth radius"),
  lty = c(1, 2, 3),
  lwd = c(2, 2, 1),
  bty = "n"
)
dev.off()

event_types <- table(factor(events$type, levels = c("Partial","Annular","Total","Hybrid")))
svg("output/03_eclipse_types.svg", width = 8, height = 6)
barplot(
  event_types,
  col = "grey70",
  border = NA,
  ylab = "Number of eclipses",
  main = "Actual solar eclipses by type"
)
dev.off()

events$year <- as.integer(substr(events$maximum, 1, 4))
annual <- table(events$year)
svg("output/04_eclipses_by_year.svg", width = 10, height = 5)
barplot(
  annual,
  col = "grey70",
  border = NA,
  las = 2,
  cex.names = 0.75,
  ylab = "Solar eclipses",
  main = "Solar eclipse frequency across one 18.6-year nodal cycle"
)
dev.off()

cat("Moon Shadows analysis complete.\n")
cat("Physical shadow passes:", nrow(stats), "\n")
cat("Actual solar eclipses:", nrow(events), "\n")
cat("Eclipses per physical pass:", round(nrow(events) / nrow(stats), 4), "\n")
cat("Outputs written to analysis/output/\n")
