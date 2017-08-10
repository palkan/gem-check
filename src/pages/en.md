# Gem Check


<div class="moto">
Help developers make other developers happier
</div>

This is the checklist for Ruby gems authors and maintainers to help them build better open-source software.

> Ruby is designed to make programmers happy. –Matz

This document is focused **only** on code aspects: API design, architecture, and documentation (because code is useless without docs). For OSS principles check out, for example, GitHub's [open source guide](https://opensource.guide).

## API Design

> Simple things should be simple, complex things should be possible. –Alan Kay

- [ ] Reduce boilerplate as much as possible

Compare writing the same functionality using `Net::HTTP` vs. [HTTParty]():

```ruby
# Net::HTTP get JSON with query string
uri = URI('http://example.com/index.json')
params = { limit: 10, page: 3 }
uri.query = URI.encode_www_form(params)

res = Net::HTTP.get_response(uri)
puts JSON.parse(res.body) if res.is_a?(Net::HTTPSuccess)

# HTTParty
puts HTTParty.get('http://example.com/index.json', limit: 10, page: 3)
```

- [ ] Do not sacrifice flexibility

Do not limit the functionality only to simple cases, i.e. allow making intricate things possible.

[HTTParty], for example, still allows to control underlying HTTP engine fully:

```ruby
HTTParty.get(
  'http://example.com/index.json', 
  { limit: 10, page: 3 },
  basic_auth: {...},
  headers: {...},
  open_timeout: 2,
  read_timeout: 3
)
```

> 80% of users use only 20% of the functionality.

- [ ] Use sensible defaults

One common pattern for sensible defaults is the [convention over configuration](https://en.wikipedia.org/wiki/Convention_over_configuration):

```ruby
class Post < ActiveRecord::Base
  # in the world with no defaults
  belongs_to :user, foreign_key: :user_id, class_name: "User", primary_key: :id
  # and with CoC
  belongs_to :user
end
```

> Try to walk in the shoes of your users.

- [ ] Follow the [Principle of least astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment)

Ruby community is mature and there is a lot of best practices. The less people think writing the code with your library the better.

For example, predicate methods (`smth?`) should return `true`/`false` and not something else (e.g. 0 and 1).
But take a look at this example from Ruby core:

```ruby
1.nonzero?
=> 1
0.nonzero?
=> nil
0.zero?
=> true
1.zero?
=> false
```

Confusing, isn't it?

Consider another example (see [issue](https://github.com/teachbase/amorail/issues/25)):

```ruby
# Amorail is an API client
Amorail::Lead.find ANY_NONEXISTENT_ID
=> false
# why false? we're looking for an object,
# nil makes more sense when nothing is found
```

Also, check [the story](https://twitter.com/schneems/status/887433898178772996) of the confusing `retries` argument.

- [ ] Use keyword arguments if you really need more than N arguments

Where _N_ is typically equal to 2.

First, kwargs are more readable and do not depend on the order.

Secondly, kwargs [allocate less objects](https://github.com/benoittgt/understand_ruby_memory#why-keywords-arguments-will-create-less-garbage-collected-objects-after-22-answered-) compared with `options = {}` argument.

Example:

```ruby
# From influxdb-ruby

# not-good
influxdb.write_point(name, data, precision, retention_policy, database)

# much better
influxdb.write_point(name, data, precision: precision, rp: retention, db: database)
```

- [ ] Raise meaningful errors

Always provide error messages: error classes for machines, error messages for humans.

Use `ArgumentError` if a method is called with wrong or missing arguments.

Provide custom error classes for library's logic related exceptions:

```ruby
# https://github.com/influxdata/influxdb-ruby/blob/master/lib/influxdb/client/http.rb
def resolve_error(response)
  if response =~ /Couldn\'t find series/
    raise InfluxDB::SeriesNotFound, response
  end
  raise InfluxDB::Error, response
end
```

- [ ] Monkey-patch reasonably

Avoid monkey-patching of core classes. Consider using [Refinements](https://ruby-doc.org/core-2.4.1/doc/syntax/refinements_rdoc.html) instead (see, for example, [`database_rewinder`](https://github.com/amatsuda/database_rewinder/blob/v0.8.2/lib/database_rewinder/cleaner.rb)).

Patch other non-core libs using `Module#prepend` (read this exhaustive [StackOverflow answer](https://stackoverflow.com/a/4471202)).

> Make it hard to shoot yourself in the foot.

- [ ] Encourage developers to avoid dangerous behavior

For example, [Minitest] uses long-and-shaming method name to disable random order for tests (` #i_suck_and_my_tests_are_order_dependent!`).

Another great idea is to show flashy warnings. Consider this [Sidekiq] example:

```ruby
if defined?(::Rails) && Rails.respond_to?(:env) && !Rails.env.test?
  puts("**************************************************")
  puts("⛔️ WARNING: Sidekiq testing API enabled,
    but this is not the test environment. 
    Your jobs will not go to Redis.")
  puts("**************************************************")
end
```

## Codebase

> Code is written once but read many times

- [ ] Write code with style

Your code should have _consistent_ style (i.e. naming, formatting, etc.).
And it would be great to respect [the community's style](https://github.com/bbatsov/ruby-style-guide).

Compare the following two snippets:

```ruby
def some_kinda_fun a, even = false
  x = if even then a+1 else a end
  {:x => a, :y => x}
end

def some_kinda_fun(a, even: false)
  x = flag ? a+1 : a
  {x: a, y: x}
end
```

Which one is more readable?

- [ ] Cover code with tests

Coverage makes sense for libraries.

But readable test cases make even more, especially integration scenarios (because they can be used as documentation).

## Architecture

> Write code for others, not for yourself

- [ ] Adapterize third-party dependencies

For example, [Active Job] is a great abstraction for background jobs, it supports different adapters, and it's easy to build your own.

From the other hand, [Action Cable] code is highly coupled with its server implementation, which makes it impossible to use other WebSocket servers without a bunch of monkey patching (at least, unless [some refactoring](https://github.com/rails/rails/pull/27648) is done).

Whenever you write a library for a particular database, framework or whatever, think beforehand about using it with alternatives.

- [ ] Keep in mind extensibility

There are different ways to build extensible libraries, e.g. by providing _middleware_ (like [Rack], [Faraday] and [Sidekiq]) 
or _plugins_ (like [Shrine] and [Devise]) functionality.

The key idea here is to provide an ability to extend functionality without patching and high-coupling.

- [ ] Provide logging functionality (when necessary)

Logging helps people to identify problems but should be _controllable_ (severity levels, custom outputs, (possibly) filtering).

The easiest way to provide flexible logging is to allow users to specify the Logger instance themselves:

```ruby
GemCheck.logger = Logger.new(STDOUT)
```

Avoid `puts` logging.

- [ ] Make code testable

Help developers to test the code using your library easily: provide custom matchers (like [Pundit](https://github.com/elabs/pundit#rspec)), testing adapters (like [Active Job](http://edgeguides.rubyonrails.org/active_job_basics.html#job-testing)), mocks (like [Fog](https://github.com/fog/fog#mocks)).

Ensure your code can be configured to be less computational-heavy in tests, like [Devise] does:

```ruby
Devise.setup do |config|
  config.stretches = Rails.env.test? ? 1 : 11
end
```

- [ ] Make configuration flexible

Provide different ways to configure your library: _manually_ thru the code, from YAML files or environmental variables.
See, for example, [`aws-sdk`](https://github.com/aws/aws-sdk-ruby#configuration).

Integration libraries **must** support [_twelve-factor-able_](https://12factor.net) configuration. You can use [anyway_config] to accomplish this.

Use sensible defaults for configuration (e.g. for Redis connection it's good to use `localhost:6379` by default) and environment variables names (e.g. `REDIS_URL` for Redis like [Sidekiq](https://github.com/mperham/sidekiq/blob/v5.0.0/lib/sidekiq/redis_connection.rb#L100-L102) does).

- [ ] Manage runtime dependencies carefully

More dependencies – more points of failures, harder upgrades.

You don't need the whole `rails` if you're only using `active_model`.
You don't need the whole `active_support` if you only need a couple of patches (consider using ad-hoc refinements instead).

Do not add as a dependency library which is only used in some use-cases (e.g. Rails do not add `redis` as a default dependency, only tells you that you maybe want to add it yourself).

Monitor your dependencies for CVE (see [bundler-audit](https://github.com/rubysec/bundler-audit)) or let [DependencyCI](https://dependencyci.com) to do all the work for you.

- [ ] Provide interoperability (if it's possible)

There is more than one major [Ruby implementation](https://en.wikipedia.org/wiki/Ruby_(programming_language)#Alternate_implementations) and at least three popular: MRI, [JRuby](http://jruby.org) and [Rubinius](https://rubinius.com) (and [TruffleRuby](https://github.com/graalvm/truffleruby) is coming). The fact that MRI is much more popular than others doesn't mean you should ditch others' users.

[Concurrent Ruby](https://github.com/ruby-concurrency/concurrent-ruby) is an excellent example of interoperability.

You should at least provide the information whether other platforms are supported or not (just add them to your CI and check – that's easy!).

## Documents

> A program is only as good as its documentation. –Joe Armstrong

- [ ] Provide at least one form of documentation

It's not always necessary to write a book or even RDocs; _well-written_ Readme could be fair enough (see [awesome-readme](https://github.com/matiassingers/awesome-readme) for examples).

_Provide benchmarks_ if your library is more performant than others in any form (at least tell users how much memory/CPU/time you saved using your solution).

- [ ] Provide examples for both simple and complex scenarios

A good example is much better than documentation.

Provide code snippets, Wiki pages for specific scenarios – just show people how you are using your own code!

- [ ] Show the current state of the project

It should be clear to users what's the current state of the project, what versions of software (language itself, dependencies) is supported (you can use badges in your Readme).

- [ ] Use semantic versioning

[SemVer](http://semver.org) helps your users to easily upgrade without thinking about breaking changes.

- [ ] Keep a changelog

Wondering why? Just read the [keepchangelog.com](http://keepachangelog.com/en/1.0.0/).

Looking for an automation? Take a look at [`github-changelog-generator`](https://github.com/skywinder/github-changelog-generato)  and [`loglive`](https://github.com/egoist/loglive).

Your commits history is also a kind of changelog, so use meaningful messages ([`git-cop`](https://github.com/bkuhlmann/git-cop) can help you with it).

- [ ] Provide upgrade notes

See, for example, [Hanami](http://hanamirb.org/guides/upgrade-notes/v100/).

## Misc

> OSS projects that don’t evolve eventually dies. –Matz

- [ ] Make code be up to date with related technologies

Try to prevent compatibility issues by monitoring dependencies upgrades ([Depfu] could help here).

Run your tests against `ruby-head`, Rails `master`, whatever – just add it to your CI, it's easy!

- [ ] Make development process less painful

Sooner or later people will try to contribute to your work. Is your development process transparent or it requires a lot of effort to setup?

For example, Rails has a [`rails-dev-box`](https://github.com/rails/rails-dev-box) to help you to start developing easily.

[Docker](https://www.docker.com) is also a good way to make dependency management simpler.

[HTTParty]: https://github.com/jnunemaker/httparty
[Active Job]: http://edgeguides.rubyonrails.org/active_job_basics.html
[Action Cable]: http://edgeguides.rubyonrails.org/action_cable_overview.html
[Rack]: https://github.com/rack/rack
[Faraday]: https://github.com/lostisland/faraday
[Sidekiq]: https://github.com/mperham/sidekiq
[Shrine]: https://github.com/janko-m/shrine
[Devise]: https://github.com/plataformatec/devise
[anyway_config]: https://github.com/palkan/anyway_config
[Minitest]: https://github.com/seattlerb/minitest
[Depfu]: https://depfu.io
