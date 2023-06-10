import m, {merge, exclude, expand, overlap, normalize, contains, parse} from "./index.js";

merge(["::", "::"])
exclude(["::"], ["::"])
expand(["::", "::"])
overlap(["::"], ["::"])
contains(["::"], ["::"])
normalize("::")
normalize("::", {compress: true})
parse("::")

m.merge(["::", "::"])
m.exclude(["::"], ["::"])
m.expand(["::", "::"])
m.overlap(["::"], ["::"])
m.contains(["::"], ["::"])
m.normalize("::")
m.normalize("::", {compress: true})
m.parse("::")
