import {merge, exclude, expand, overlap, normalize, contains, parse} from "./index.js";

merge(["::", "::"])
exclude(["::"], ["::"])
expand(["::", "::"])
overlap(["::"], ["::"])
contains(["::"], ["::"])
normalize("::")
normalize("::", {compress: true})
parse("::")
