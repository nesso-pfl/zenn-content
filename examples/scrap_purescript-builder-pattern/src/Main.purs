module Main where

import Prelude
import Data.Maybe (Maybe(..))
import Effect (Effect)
import Effect.Class.Console (logShow)
import Effect.Console (log)
import Prim.Row (class Union)
import Unsafe.Coerce (unsafeCoerce)

type RequiredA
  = ( domain :: String
    , client_id :: String
    , address :: String
    , scope :: String
    , audience :: String
    , response_type :: String
    , response_mode :: String
    , leeway :: Int
    , _disable_deprecation_warnings :: Boolean
    )

type OptionalA
  = { address :: String
    , scope :: String
    , audience :: String
    , response_type :: String
    , response_mode :: String
    , leeway :: Int
    , _disable_deprecation_warnings :: Boolean
    }

makeA :: ∀ fields fields' a. Union fields fields' RequiredA => Record fields -> Record RequiredA
makeA = unsafeCoerce

ho :: Effect Unit
ho = do
  let
    a = makeA { client_id: "hoge" }
  logShow a

type WebAuthConfig
  = { domain :: String
    , client_id :: String
    , address :: Maybe String
    , scope :: Maybe String
    , audience :: Maybe String
    , response_type :: Maybe String
    , response_mode :: Maybe String
    , leeway :: Maybe Int
    , _disable_deprecation_warnings :: Maybe Boolean
    }

newtype WebAuthDefaultConfig a
  = WebAuthDefaultConfig
  { domain :: String
  , client_id :: String
  | a
  }

build :: ∀ a. WebAuthDefaultConfig a -> WebAuthConfig
build (WebAuthDefaultConfig x) =
  { domain: x.domain
  , client_id: x.client_id
  , address: Nothing
  , scope: Nothing
  , audience: Nothing
  , response_type: Nothing
  , response_mode: Nothing
  , leeway: Nothing
  , _disable_deprecation_warnings: Nothing
  }

main :: Effect Unit
main = do
  log "hoyo"
