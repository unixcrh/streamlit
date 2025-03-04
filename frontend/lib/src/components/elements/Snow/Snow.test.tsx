/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { mount } from "@streamlit/lib/src/test_util"

import Snow, {
  SnowProps,
  NUM_FLAKES,
} from "@streamlit/lib/src/components/elements/Snow/index"

const getProps = (): SnowProps => ({
  scriptRunId: "51522269",
})

describe("Snow element", () => {
  jest.useFakeTimers()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Snow {...props} />)

    expect(wrapper).toBeDefined()
    expect(wrapper.find("StyledFlake").length).toBe(NUM_FLAKES)

    wrapper.find("StyledFlake").forEach(node => {
      expect(node.prop("src")).toBeTruthy()
    })
  })

  it("renders as hidden element", () => {
    const props = getProps()
    const wrapper = mount(<Snow {...props} />)

    expect(wrapper.find("div").prop("className")).toContain("stHidden")
  })
})
